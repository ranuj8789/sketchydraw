package com.sketchydraw;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SketchyDrawApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(SketchyDrawApiApplication.class, args);
    }
}