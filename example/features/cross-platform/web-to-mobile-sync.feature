@cross-platform
Feature: Todo created on web appears on Flutter mobile app

  Scenario: Full platform sync
    Given I am on the todo web application
    When I log in as "user@example.com" with password "secret"
    And I create a todo titled "Buy groceries"
    Then the todo "Buy groceries" appears on the web dashboard
    And the API should return the todo "Buy groceries" with status "open"
    And the Flutter app should display "Buy groceries" in the todo list
