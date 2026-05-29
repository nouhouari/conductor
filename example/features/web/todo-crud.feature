@web
Feature: Todo CRUD on the web

  Background:
    Given I am on the todo web application
    When I log in as "user@example.com" with password "secret"

  Scenario: Create a new todo
    When I create a todo titled "Buy groceries"
    Then the todo "Buy groceries" appears on the web dashboard
    And the todo "Buy groceries" should have status "open" on the web
    And I take a web screenshot "web-create-todo"

  Scenario: Edit an existing todo
    Given a todo "Draft report" exists via the API
    And I am on the todo web application
    When I edit the todo "Draft report" to "Final report"
    Then the todo "Final report" appears on the web dashboard
    And the todo "Draft report" should not appear on the web dashboard
    And I take a web screenshot "web-edit-todo"

  Scenario: Mark a todo as done
    Given a todo "Clean kitchen" exists via the API
    And I am on the todo web application
    When I toggle the todo "Clean kitchen"
    Then the todo "Clean kitchen" should have status "done" on the web
    And I take a web screenshot "web-toggle-done"

  Scenario: Mark a done todo back to open
    Given a todo "Water plants" exists via the API
    And I am on the todo web application
    When I toggle the todo "Water plants"
    And I toggle the todo "Water plants"
    Then the todo "Water plants" should have status "open" on the web

  Scenario: Delete a todo
    Given a todo "Old task" exists via the API
    And I am on the todo web application
    When I delete the todo "Old task"
    Then the todo "Old task" should not appear on the web dashboard
    And I take a web screenshot "web-delete-todo"

  Scenario: Default priority is not urgent
    When I create a todo titled "Quick note"
    Then the todo "Quick note" appears on the web dashboard
    And the todo "Quick note" should have priority "not urgent" on the web

  Scenario Outline: Create a todo with <priority> priority
    When I create a todo titled "<title>" with priority "<priority>"
    Then the todo "<title>" appears on the web dashboard
    And the todo "<title>" should have priority "<priority>" on the web
    And I take a web screenshot "web-priority-<priority>"

    Examples:
      | title          | priority   |
      | Server down    | critical   |
      | Client meeting | urgent     |
      | Update docs    | not urgent |
