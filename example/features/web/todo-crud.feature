@web
Feature: Todo CRUD on the web
  Background:
    Given I am on the todo web application

  Scenario: Create a new todo
    When I log in as "user@example.com" with password "secret"
    And I create a todo titled "Buy groceries"
    Then the todo "Buy groceries" appears on the web dashboard
