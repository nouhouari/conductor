@api
Feature: Todo API
  Scenario: List todos via REST API
    Then the API should return the todo "Buy groceries" with status "open"
