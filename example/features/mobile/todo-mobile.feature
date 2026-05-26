@mobile
Feature: Todo app on Flutter mobile

  Scenario: App launches and shows the home screen
    When the Flutter app launches
    Then the home screen is visible

  Scenario: Empty todo list shows placeholder message
    When the Flutter app launches with a clean state
    Then the todo list shows "No todos yet"

  Scenario: Todo created via API appears on mobile
    Given a todo "Buy groceries" exists in the system
    When the Flutter app launches
    And I navigate to the todo list
    Then the todo "Buy groceries" is visible on screen
    And a screenshot "todo-visible" is taken
