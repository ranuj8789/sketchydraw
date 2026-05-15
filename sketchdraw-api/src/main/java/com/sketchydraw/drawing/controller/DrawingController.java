package com.sketchydraw.drawing.controller;

import com.sketchydraw.drawing.dto.CreateDrawingGroupRequest;
import com.sketchydraw.drawing.dto.SaveDrawingRequest;
import com.sketchydraw.drawing.service.DrawingGroupService;
import com.sketchydraw.drawing.service.DrawingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/drawings")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DrawingController {

    private final DrawingService drawingService;
    private final DrawingGroupService drawingGroupService;

    @PostMapping
    public ResponseEntity<?> saveDrawing(
            Principal principal,
            @RequestBody SaveDrawingRequest request
    ) {
        return ResponseEntity.ok(
                drawingService.saveDrawing(principal.getName(), request)
        );
    }

    @GetMapping
    public ResponseEntity<?> listDrawings(Principal principal) {
        return ResponseEntity.ok(
                drawingService.listDrawings(principal.getName())
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getDrawing(
            Principal principal,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(
                drawingService.getDrawing(principal.getName(), id)
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDrawing(
            Principal principal,
            @PathVariable Long id
    ) {
        drawingService.deleteDrawing(principal.getName(), id);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Drawing deleted successfully"
        ));
    }

    @GetMapping("/groups")
    public ResponseEntity<?> listGroups(Principal principal) {
        return ResponseEntity.ok(
                drawingGroupService.listGroups(principal.getName())
        );
    }

    @PostMapping("/groups")
    public ResponseEntity<?> createGroup(
            Principal principal,
            @RequestBody CreateDrawingGroupRequest request
    ) {
        return ResponseEntity.ok(
                drawingGroupService.createGroup(principal.getName(), request)
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", ex.getMessage()
        ));
    }
}