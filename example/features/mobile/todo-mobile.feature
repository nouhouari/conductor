@mobile
Feature: Todo CRUD on Flutter mobile app

  Scenario: App launches and shows the home screen
    When the Flutter app launches
    Then the home screen is visible

  Scenario: Empty todo list shows placeholder message
    When the Flutter app launches with a clean state
    Then the todo list shows "No todos yet"

  @crud
  Scenario: Create a todo on mobile
    When I create a todo "Buy groceries" on the mobile app
    Then the mobile app should display "Buy groceries"
    And I take a mobile screenshot "mobile-create-todo"

  Scenario: Read a todo seeded via API
    Given a todo "Server task" exists in the system
    When the Flutter app launches
    Then the mobile app should display "Server task"
    And I take a mobile screenshot "mobile-read-todo"

  @crud
  Scenario: Edit a todo on mobile
    Given a todo "Draft report" exists in the system
    When I edit the todo "Draft report" to "Final report" on the mobile app
    Then the mobile app should display "Final report"
    And I take a mobile screenshot "mobile-edit-todo"

  Scenario: Mark a todo as done on mobile
    Given a todo "Clean kitchen" exists in the system
    When I mark the todo "Clean kitchen" as done on the mobile app
    Then the API should return the todo "Clean kitchen" with status "done"

  Scenario: Mark a done todo back to open on mobile
    Given a todo "Water plants" exists in the system
    When I mark the todo "Water plants" as done on the mobile app
    And I mark the todo "Water plants" as open on the mobile app
    Then the API should return the todo "Water plants" with status "open"

  @crud
  Scenario: Delete a todo on mobile
    Given a todo "Old task" exists in the system
    When I delete the todo "Old task" on the mobile app
    Then the API should not return a todo "Old task"
