package com.example.todoapp;

import com.example.todoapp.service.TodoService;
import com.example.todoapp.ui.MainView;
import javafx.application.Application;
import javafx.scene.Scene;
import javafx.stage.Stage;

public class TodoApp extends Application {
    @Override
    public void start(Stage stage) {
        var apiUrl = System.getProperty("API_BASE_URL",
            System.getenv().getOrDefault("API_BASE_URL", "http://localhost:3000/api"));

        var service = new TodoService(apiUrl);
        var mainView = new MainView(service);
        var scene = new Scene(mainView, 700, 500);

        stage.setTitle("Todo App — Desktop");
        stage.setScene(scene);
        stage.show();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
