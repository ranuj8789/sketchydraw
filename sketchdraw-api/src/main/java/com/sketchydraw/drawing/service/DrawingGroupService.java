package com.sketchydraw.drawing.service;

import com.sketchydraw.drawing.dto.CreateDrawingGroupRequest;
import com.sketchydraw.drawing.entity.DrawingGroup;
import com.sketchydraw.drawing.repository.DrawingGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DrawingGroupService {

    public static final String DEFAULT_GROUP = "My Workspace";

    private final DrawingGroupRepository drawingGroupRepository;

    public List<DrawingGroup> listGroups(String userEmail) {
        return drawingGroupRepository.findByUserEmailOrderByUpdatedAtDesc(userEmail);
    }

    public DrawingGroup createGroup(String userEmail, CreateDrawingGroupRequest request) {
        String name = normalizeGroupName(request == null ? null : request.getName());

        return createGroupIfMissing(userEmail, name);
    }

    public DrawingGroup getOrCreateDefaultGroup(String userEmail, String groupName) {
        return createGroupIfMissing(userEmail, groupName);
    }

    public DrawingGroup createGroupIfMissing(String userEmail, String groupName) {
        String name = normalizeGroupName(groupName);

        return drawingGroupRepository
                .findByUserEmailAndNameIgnoreCase(userEmail, name)
                .orElseGet(() -> {
                    LocalDateTime now = LocalDateTime.now();

                    DrawingGroup group = new DrawingGroup();
                    group.setUserEmail(userEmail);
                    group.setName(name);
                    group.setCreatedAt(now);
                    group.setUpdatedAt(now);

                    return drawingGroupRepository.save(group);
                });
    }

    public String normalizeGroupName(String groupName) {
        if (groupName == null || groupName.isBlank()) {
            return DEFAULT_GROUP;
        }

        return groupName.trim();
    }
}