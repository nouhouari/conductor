package com.example.todoapp.ui;

import com.example.todoapp.model.Todo;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.*;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import java.util.function.Consumer;

public class TodoCell extends ListCell<Todo> {
    private final Consumer<Todo> onToggle;
    private final Consumer<Todo> onEdit;
    private final Consumer<Todo> onDelete;

    public TodoCell(Consumer<Todo> onToggle, Consumer<Todo> onEdit, Consumer<Todo> onDelete) {
        this.onToggle = onToggle;
        this.onEdit = onEdit;
        this.onDelete = onDelete;
    }

    @Override
    protected void updateItem(Todo todo, boolean empty) {
        super.updateItem(todo, empty);
        if (empty || todo == null) {
            setGraphic(null);
            setStyle("");
            return;
        }

        var checkBox = new CheckBox();
        checkBox.setId("toggle-" + todo.getId());
        checkBox.setSelected(todo.isDone());
        checkBox.setOnAction(e -> onToggle.accept(todo));

        var titleLabel = new Label(todo.getTitle());
        titleLabel.setId("title-" + todo.getId());
        titleLabel.getStyleClass().add("todo-title");
        if (todo.isDone()) {
            titleLabel.setStyle("-fx-strikethrough: true; -fx-text-fill: #999;");
        }

        var priorityLabel = new Label(todo.getPriority());
        priorityLabel.setId("priority-" + todo.getId());
        priorityLabel.setStyle("-fx-font-size: 11; -fx-text-fill: #666;");

        var spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        var editBtn = new Button("Edit");
        editBtn.setId("edit-" + todo.getId());
        editBtn.setStyle("-fx-font-size: 11;");
        editBtn.setOnAction(e -> onEdit.accept(todo));

        var deleteBtn = new Button("Delete");
        deleteBtn.setId("delete-" + todo.getId());
        deleteBtn.setStyle("-fx-font-size: 11; -fx-text-fill: #dc2626;");
        deleteBtn.setOnAction(e -> onDelete.accept(todo));

        var row = new HBox(8, checkBox, titleLabel, priorityLabel, spacer, editBtn, deleteBtn);
        row.setAlignment(Pos.CENTER_LEFT);
        row.setPadding(new Insets(6, 10, 6, 10));

        setGraphic(row);
        setPadding(new Insets(2, 0, 2, 0));

        switch (todo.getPriority()) {
            case "critical" -> setStyle("-fx-background-color: #fee2e2;");
            case "urgent" -> setStyle("-fx-background-color: #fef3c7;");
            case "not urgent" -> setStyle("-fx-background-color: #dcfce7;");
            default -> setStyle("");
        }
    }
}
