package com.sketchydraw.video.dto;

public class StartVideoExportRequest {
    private int width;
    private int height;
    private int fps;
    private int frameCount;

    public int getWidth() { return width; }
    public void setWidth(int width) { this.width = width; }
    public int getHeight() { return height; }
    public void setHeight(int height) { this.height = height; }
    public int getFps() { return fps; }
    public void setFps(int fps) { this.fps = fps; }
    public int getFrameCount() { return frameCount; }
    public void setFrameCount(int frameCount) { this.frameCount = frameCount; }
}
