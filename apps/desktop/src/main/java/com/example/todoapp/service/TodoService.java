package com.example.todoapp.service;

import com.example.todoapp.model.Todo;
import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;

public class TodoService {
    private final String baseUrl;
    private final HttpClient client;

    public TodoService(String baseUrl) {
        this.baseUrl = baseUrl;
        this.client = HttpClient.newHttpClient();
    }

    public List<Todo> fetchAll() throws Exception {
        var request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/todos"))
            .GET()
            .build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());
        var array = new JSONArray(response.body());
        var todos = new ArrayList<Todo>();
        for (int i = 0; i < array.length(); i++) {
            todos.add(Todo.fromJson(array.getJSONObject(i)));
        }
        return todos;
    }

    public Todo create(String title, String priority) throws Exception {
        var body = new JSONObject()
            .put("title", title)
            .put("status", "open")
            .put("priority", priority);
        var request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/todos"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
            .build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());
        return Todo.fromJson(new JSONObject(response.body()));
    }

    public Todo update(int id, String title, String status, String priority) throws Exception {
        var body = new JSONObject();
        if (title != null) body.put("title", title);
        if (status != null) body.put("status", status);
        if (priority != null) body.put("priority", priority);
        var request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/todos/" + id))
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(body.toString()))
            .build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());
        return Todo.fromJson(new JSONObject(response.body()));
    }

    public void delete(int id) throws Exception {
        var request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/todos/" + id))
            .DELETE()
            .build();
        client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
