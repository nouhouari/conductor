@api
Feature: Todo CRUD via REST API

  Scenario: Create a todo via API
    When I create a todo "Write tests" via the API
    Then the API should return the todo "Write tests" with status "open"

  Scenario: Update a todo title via API
    Given a todo "Old title" exists via the API
    When I update the todo "Old title" title to "New title" via the API
    Then the API should return the todo "New title" with status "open"
    And the API should not return a todo "Old title"

  Scenario: Update a todo status via API
    Given a todo "Review PR" exists via the API
    When I update the todo "Review PR" status to "done" via the API
    Then the API should return the todo "Review PR" with status "done"

  Scenario: Delete a todo via API
    Given a todo "Temporary task" exists via the API
    When I delete the todo "Temporary task" via the API
    Then the API should not return a todo "Temporary task"

  Scenario: Create a todo with critical priority via API
    When I create a todo "Production fix" with priority "critical" via the API
    Then the API should return the todo "Production fix" with priority "critical"

  Scenario: Create a todo with urgent priority via API
    When I create a todo "Review feedback" with priority "urgent" via the API
    Then the API should return the todo "Review feedback" with priority "urgent"

  Scenario: Default priority is not urgent
    When I create a todo "Low priority task" via the API
    Then the API should return the todo "Low priority task" with priority "not urgent"

  Scenario: Update a todo priority via API
    Given a todo "Reprioritize me" exists via the API
    When I update the todo "Reprioritize me" priority to "critical" via the API
    Then the API should return the todo "Reprioritize me" with priority "critical"
