@cross-platform
Feature: Todo CRUD syncs across web, API, and mobile

  Scenario: Todo created on web appears on the Flutter mobile app
    Given I am on the todo web application
    When I log in as "user@example.com" with password "secret"
    And I create a todo titled "E2E Cross Platform"
    Then the todo "E2E Cross Platform" appears on the web dashboard
    And I take a web screenshot "cross-web-create"
    And the API should return the todo "E2E Cross Platform" with status "open"
    And the Flutter app should display "E2E Cross Platform" in the todo list

  Scenario: Todo created on web is visible via API
    Given I am on the todo web application
    When I log in as "user@example.com" with password "secret"
    And I create a todo titled "Buy groceries"
    Then the todo "Buy groceries" appears on the web dashboard
    And the API should return the todo "Buy groceries" with status "open"

  Scenario: Todo created via API is visible on web
    Given a todo "Server task" exists via the API
    And I am on the todo web application
    When I log in as "user@example.com" with password "secret"
    Then the todo "Server task" appears on the web dashboard
    And I take a web screenshot "cross-api-to-web"

  Scenario: Todo updated on web is reflected in API
    Given a todo "Rename me" exists via the API
    And I am on the todo web application
    When I log in as "user@example.com" with password "secret"
    And I edit the todo "Rename me" to "Renamed"
    Then the API should return the todo "Renamed" with status "open"
    And the API should not return a todo "Rename me"

  Scenario: Todo toggled on web is reflected in API
    Given a todo "Toggle me" exists via the API
    And I am on the todo web application
    When I log in as "user@example.com" with password "secret"
    And I toggle the todo "Toggle me"
    Then the API should return the todo "Toggle me" with status "done"

  Scenario: Todo deleted on web is removed from API
    Given a todo "Delete me" exists via the API
    And I am on the todo web application
    When I log in as "user@example.com" with password "secret"
    And I delete the todo "Delete me"
    Then the API should not return a todo "Delete me"

  Scenario Outline: Todo with <priority> priority syncs from web to API
    Given I am on the todo web application
    When I log in as "user@example.com" with password "secret"
    And I create a todo titled "<title>" with priority "<priority>"
    Then the todo "<title>" should have priority "<priority>" on the web
    And I take a web screenshot "cross-priority-<priority>"
    And the API should return the todo "<title>" with priority "<priority>"

    Examples:
      | title              | priority   |
      | Urgent fix         | critical   |
      | Urgent deployment  | urgent     |
      | Low priority docs  | not urgent |

  Scenario: Todo with priority created via API shows correct priority on web
    Given a todo "API critical task" with priority "critical" exists via the API
    And I am on the todo web application
    When I log in as "user@example.com" with password "secret"
    Then the todo "API critical task" should have priority "critical" on the web
