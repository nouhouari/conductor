@flutter-desktop
Feature: Todo CRUD via Flutter desktop app

  Background:
    Given the Flutter desktop app is running

  Scenario: Home screen displays the app title
    Then the Flutter desktop app shows "My Todos"

  Scenario: Create a todo via Flutter desktop
    When I add a todo "Buy milk" via the Flutter desktop app
    Then the Flutter desktop app shows "Buy milk"
    And the API should return the todo "Buy milk" with status "open"
    And I take a Flutter desktop screenshot "flutter-desktop-create"

  Scenario: Toggle a todo to done via Flutter desktop
    Given a todo "Walk the dog" exists via the API
    When I refresh the Flutter desktop app
    And I toggle the todo "Walk the dog" via the Flutter desktop app
    Then the API should return the todo "Walk the dog" with status "done"

  Scenario: Edit a todo title via Flutter desktop
    Given a todo "Old flutter title" exists via the API
    When I refresh the Flutter desktop app
    And I edit the todo "Old flutter title" to "New flutter title" via the Flutter desktop app
    Then the Flutter desktop app shows "New flutter title"
    And the API should return the todo "New flutter title" with status "open"

  Scenario: Delete a todo via Flutter desktop
    Given a todo "Delete via flutter" exists via the API
    When I refresh the Flutter desktop app
    And I delete the todo "Delete via flutter" via the Flutter desktop app
    Then the Flutter desktop app does not show "Delete via flutter"
    And the API should not return a todo "Delete via flutter"
