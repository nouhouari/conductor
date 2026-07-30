package com.nouhouari.conductor.example.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Java port of the structural `interface TodoResponse` used for casting in the TS step defs. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TodoResponse(int id, String title, String status, String priority) {
}
