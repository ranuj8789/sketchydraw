package com.sketchydraw.drawing.service;

import com.sketchydraw.auth.entity.User;
import com.sketchydraw.auth.repository.UserRepository;
import com.sketchydraw.drawing.dto.DrawingListResponse;
import com.sketchydraw.drawing.dto.SaveDrawingRequest;
import com.sketchydraw.drawing.dto.SavedDrawingResponse;
import com.sketchydraw.drawing.entity.SavedDrawing;
import com.sketchydraw.drawing.repository.SavedDrawingRepository;
import com.sketchydraw.payment.service.SubscriptionGuardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DrawingService {

    private final UserRepository userRepository;
    private final SavedDrawingRepository savedDrawingRepository;
    private final SubscriptionGuardService subscriptionGuardService;
    private final DrawingGroupService drawingGroupService;

    public SavedDrawingResponse saveDrawing(String email, SaveDrawingRequest request) {
        User user = getUser(email);

        subscriptionGuardService.requireActiveSubscription(user.getId());

        validateRequest(request);

        String groupName = resolveGroupName(request);
        String description = request.getDescription() == null
                ? ""
                : request.getDescription().trim();

        drawingGroupService.createGroupIfMissing(email, groupName);

        SavedDrawing drawing;

        if (request.getId() != null) {
            drawing = savedDrawingRepository.findByIdAndUserId(request.getId(), user.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Drawing not found"));
        } else {
            drawing = new SavedDrawing();
            drawing.setUserId(user.getId());
            drawing.setCreatedAt(LocalDateTime.now());
        }

        drawing.setTitle(request.getTitle().trim());
        drawing.setGroupName(groupName);
        drawing.setDescription(description);
        drawing.setDrawingJson(request.getDrawingJson());
        drawing.setDrawingType("EXCALIDRAW");
        drawing.setUpdatedAt(LocalDateTime.now());

        savedDrawingRepository.save(drawing);

        return toResponse(drawing);
    }

    public List<DrawingListResponse> listDrawings(String email) {
        User user = getUser(email);

        subscriptionGuardService.requireActiveSubscription(user.getId());

        return savedDrawingRepository.findByUserIdOrderByUpdatedAtDesc(user.getId())
                .stream()
                .map(d -> new DrawingListResponse(
                        d.getId(),
                        d.getTitle(),
                        normalizeSavedGroup(d.getGroupName()),
                        normalizeSavedGroup(d.getGroupName()),
                        d.getDescription(),
                        d.getDrawingType(),
                        d.getUpdatedAt()
                ))
                .toList();
    }

    public SavedDrawingResponse getDrawing(String email, Long id) {
        User user = getUser(email);

        subscriptionGuardService.requireActiveSubscription(user.getId());

        SavedDrawing drawing = savedDrawingRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Drawing not found"));

        return toResponse(drawing);
    }

    public void deleteDrawing(String email, Long id) {
        User user = getUser(email);

        subscriptionGuardService.requireActiveSubscription(user.getId());

        SavedDrawing drawing = savedDrawingRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Drawing not found"));

        savedDrawingRepository.delete(drawing);
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private void validateRequest(SaveDrawingRequest request) {
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new IllegalArgumentException("Drawing title is required");
        }

        if (request.getDrawingJson() == null || request.getDrawingJson().isBlank()) {
            throw new IllegalArgumentException("Drawing JSON is required");
        }

        if (request.getDrawingJson().length() > 5_000_000) {
            throw new IllegalArgumentException("Drawing JSON is too large");
        }
    }

    private String resolveGroupName(SaveDrawingRequest request) {
        if (request.getGroupName() != null && !request.getGroupName().isBlank()) {
            return request.getGroupName().trim();
        }

        if (request.getWorkspace() != null && !request.getWorkspace().isBlank()) {
            return request.getWorkspace().trim();
        }

        return DrawingGroupService.DEFAULT_GROUP;
    }

    private String normalizeSavedGroup(String groupName) {
        if (groupName == null || groupName.isBlank()) {
            return DrawingGroupService.DEFAULT_GROUP;
        }

        return groupName.trim();
    }

    private SavedDrawingResponse toResponse(SavedDrawing drawing) {
        String groupName = normalizeSavedGroup(drawing.getGroupName());

        return new SavedDrawingResponse(
                drawing.getId(),
                drawing.getTitle(),
                groupName,
                groupName,
                drawing.getDescription(),
                drawing.getDrawingJson(),
                drawing.getDrawingType(),
                drawing.getCreatedAt(),
                drawing.getUpdatedAt()
        );
    }
}