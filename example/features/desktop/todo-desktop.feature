@desktop
Feature: Todo CRUD via JavaFX desktop app

  Background:
    Given the desktop app is running

  Scenario: Create a todo with critical priority via desktop UI
    When I create a todo "Desktop critical" with priority "critical" via the desktop app
    Then the todo "Desktop critical" should be visible on the desktop app
    And the API should return the todo "Desktop critical" with priority "critical"
    And I take a desktop screenshot "desktop-create-critical"

  Scenario: Create a todo with default priority via desktop UI
    When I create a todo "Quick note" via the desktop app
    Then the todo "Quick note" should be visible on the desktop app
    And the API should return the todo "Quick note" with priority "not urgent"

  Scenario: Edit a todo via desktop UI
    Given a todo "Old title" exists via the API
    When I edit the todo "Old title" to "New title" via the desktop app
    Then the todo "New title" should be visible on the desktop app
    And the API should return the todo "New title" with status "open"

  Scenario: Toggle a todo to done via desktop UI
    Given a todo "Toggle me" exists via the API
    When I toggle the todo "Toggle me" via the desktop app
    Then the API should return the todo "Toggle me" with status "done"

  Scenario: Delete a todo via desktop UI
    Given a todo "Delete me" exists via the API
    When I delete the todo "Delete me" via the desktop app
    Then the todo "Delete me" should not be visible on the desktop app
    And the API should not return a todo "Delete me"

  Scenario Outline: Create a todo with <priority> priority via desktop UI
    When I create a todo "<title>" with priority "<priority>" via the desktop app
    Then the todo "<title>" should be visible on the desktop app
    And the API should return the todo "<title>" with priority "<priority>"

    Examples:
      | title            | priority   |
      | Production fix   | critical   |
      | Review feedback  | urgent     |
      | Update readme    | not urgent |
