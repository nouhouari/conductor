package com.example.todoapp.model;

import org.json.JSONObject;

public class Todo {
    private int id;
    private String title;
    private String status;
    private String priority;

    public Todo(int id, String title, String status, String priority) {
        this.id = id;
        this.title = title;
        this.status = status;
        this.priority = priority;
    }

    public static Todo fromJson(JSONObject json) {
        return new Todo(
            json.getInt("id"),
            json.getString("title"),
            json.optString("status", "open"),
            json.optString("priority", "not urgent")
        );
    }

    public int getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public boolean isDone() { return "done".equals(status); }

    @Override
    public String toString() { return title; }
}
