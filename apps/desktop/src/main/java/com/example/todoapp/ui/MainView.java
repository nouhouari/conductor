package com.example.todoapp.ui;

import com.example.todoapp.model.Todo;
import com.example.todoapp.service.TodoService;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.scene.control.*;
import javafx.scene.layout.*;

public class MainView extends BorderPane {
    private final TodoService service;
    private final ObservableList<Todo> todos = FXCollections.observableArrayList();
    private final Label statusLabel = new Label("Ready");

    public MainView(TodoService service) {
        this.service = service;

        setTop(buildToolbar());
        setCenter(buildList());
        setBottom(buildStatusBar());

        refresh();
    }

    private HBox buildToolbar() {
        var titleField = new TextField();
        titleField.setId("todo-input");
        titleField.setPromptText("What needs to be done?");
        HBox.setHgrow(titleField, Priority.ALWAYS);

        var priorityBox = new ComboBox<String>();
        priorityBox.setId("todo-priority-select");
        priorityBox.getItems().addAll("not urgent", "urgent", "critical");
        priorityBox.setValue("not urgent");
        priorityBox.setPrefWidth(120);

        var addBtn = new Button("Add");
        addBtn.setId("todo-add");
        addBtn.setDefaultButton(true);
        addBtn.setOnAction(e -> {
            var title = titleField.getText().trim();
            if (title.isEmpty()) return;
            addBtn.setDisable(true);
            new Thread(() -> {
                try {
                    service.create(title, priorityBox.getValue());
                    Platform.runLater(() -> {
                        titleField.clear();
                        refresh();
                        addBtn.setDisable(false);
                    });
                } catch (Exception ex) {
                    Platform.runLater(() -> {
                        showError("Failed to create todo: " + ex.getMessage());
                        addBtn.setDisable(false);
                    });
                }
            }).start();
        });

        var toolbar = new HBox(8, titleField, priorityBox, addBtn);
        toolbar.setPadding(new Insets(10));
        return toolbar;
    }

    private ListView<Todo> buildList() {
        var listView = new ListView<>(todos);
        listView.setId("todo-list");
        listView.setCellFactory(lv -> new TodoCell(this::toggleTodo, this::editTodo, this::deleteTodo));
        listView.setPlaceholder(new Label("No todos yet"));
        return listView;
    }

    private HBox buildStatusBar() {
        var refreshBtn = new Button("Refresh");
        refreshBtn.setId("refresh-btn");
        refreshBtn.setOnAction(e -> refresh());

        var spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        var bar = new HBox(8, statusLabel, spacer, refreshBtn);
        bar.setPadding(new Insets(6, 10, 6, 10));
        bar.setStyle("-fx-background-color: #f5f5f5; -fx-border-color: #ddd; -fx-border-width: 1 0 0 0;");
        return bar;
    }

    private void refresh() {
        statusLabel.setText("Loading...");
        new Thread(() -> {
            try {
                var list = service.fetchAll();
                Platform.runLater(() -> {
                    todos.setAll(list);
                    statusLabel.setText(list.size() + " todo(s)");
                });
            } catch (Exception ex) {
                Platform.runLater(() -> showError("Failed to load: " + ex.getMessage()));
            }
        }).start();
    }

    private void toggleTodo(Todo todo) {
        var newStatus = todo.isDone() ? "open" : "done";
        new Thread(() -> {
            try {
                service.update(todo.getId(), null, newStatus, null);
                Platform.runLater(this::refresh);
            } catch (Exception ex) {
                Platform.runLater(() -> showError("Failed to toggle: " + ex.getMessage()));
            }
        }).start();
    }

    private void editTodo(Todo todo) {
        var dialog = new TextInputDialog(todo.getTitle());
        dialog.setTitle("Edit Todo");
        dialog.setHeaderText(null);
        dialog.setContentText("Title:");
        dialog.showAndWait().ifPresent(newTitle -> {
            if (newTitle.trim().isEmpty() || newTitle.trim().equals(todo.getTitle())) return;
            new Thread(() -> {
                try {
                    service.update(todo.getId(), newTitle.trim(), null, null);
                    Platform.runLater(this::refresh);
                } catch (Exception ex) {
                    Platform.runLater(() -> showError("Failed to edit: " + ex.getMessage()));
                }
            }).start();
        });
    }

    private void deleteTodo(Todo todo) {
        var alert = new Alert(Alert.AlertType.CONFIRMATION, "Delete \"" + todo.getTitle() + "\"?");
        alert.setTitle("Delete Todo");
        alert.setHeaderText(null);
        alert.showAndWait().ifPresent(result -> {
            if (result != ButtonType.OK) return;
            new Thread(() -> {
                try {
                    service.delete(todo.getId());
                    Platform.runLater(this::refresh);
                } catch (Exception ex) {
                    Platform.runLater(() -> showError("Failed to delete: " + ex.getMessage()));
                }
            }).start();
        });
    }

    private void showError(String message) {
        statusLabel.setText(message);
        var alert = new Alert(Alert.AlertType.ERROR, message);
        alert.setTitle("Error");
        alert.setHeaderText(null);
        alert.showAndWait();
    }
}
