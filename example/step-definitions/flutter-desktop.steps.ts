import * as fs from 'fs';
import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from '@nouhouari/conductor-e2e';
import type { Finder } from '@nouhouari/conductor-e2e';

const TIMEOUT = { timeout: 60000 };

const byText = (text: string): Finder => ({ type: 'ByText', value: text });
const byTooltip = (tooltip: string): Finder => ({ type: 'ByTooltipMessage', value: tooltip });
const byKey = (key: string): Finder => ({ type: 'ByValueKey', value: key });

Given('the Flutter desktop app is running', TIMEOUT, async function (this: ConductorWorld) {
  await this.flutterDesktop.launch();
  await this.flutterDesktop.waitFor(byText('My Todos'), 15000);
  // Drain the initial _loadTodos() so later steps don't race with it.
  await this.flutterDesktop.requestData(JSON.stringify({ action: 'waitUntilLoaded' }), 15000);
});

When('I add a todo {string} via the Flutter desktop app', TIMEOUT, async function (this: ConductorWorld, title: string) {
  await this.flutterDesktop.tap(byKey('add-todo-fab'));
  await this.flutterDesktop.waitFor(byKey('dialog-title-input'));
  // Inject text directly into the controller — avoids the TestTextInput mock
  // path where _client stays null on macOS because autofocus establishes the
  // connection before set_text_entry_emulation registers the mock.
  const setResp = await this.flutterDesktop.requestData(
    JSON.stringify({ action: 'setDialogText', text: title }),
    10000
  );
  if (setResp.startsWith('error:')) throw new Error(`setDialogText failed: ${setResp}`);
  await this.flutterDesktop.tap(byText('Save'));
  await this.flutterDesktop.waitFor(byText(title));
  this.data.lastTodoTitle = title;
});

When('I refresh the Flutter desktop app', TIMEOUT, async function (this: ConductorWorld) {
  // Use requestData so the step waits for _loadTodos() to complete, rather
  // than relying on a tap gesture that may not fire onPressed on macOS desktop.
  const resp = await this.flutterDesktop.requestData(
    JSON.stringify({ action: 'refresh' }),
    15000
  );
  if (resp.startsWith('error:')) throw new Error(`refresh failed: ${resp}`);
});

// Toggle, edit, delete use requestData to invoke app-side handlers directly,
// bypassing flutter_driver's hitTestable() which never resolves for widgets
// inside a ListView (Scrollable blocks hit tests with HitTestBehavior.opaque).

When('I toggle the todo {string} via the Flutter desktop app', TIMEOUT, async function (this: ConductorWorld, title: string) {
  const resp = await this.flutterDesktop.requestData(
    JSON.stringify({ action: 'toggleTodo', title }),
    15000
  );
  if (resp.startsWith('error:')) throw new Error(`toggleTodo failed: ${resp}`);
  await new Promise(r => setTimeout(r, 300));
});

When('I edit the todo {string} to {string} via the Flutter desktop app', TIMEOUT, async function (this: ConductorWorld, currentTitle: string, newTitle: string) {
  const resp = await this.flutterDesktop.requestData(
    JSON.stringify({ action: 'editTodoTitle', currentTitle, newTitle }),
    15000
  );
  if (resp.startsWith('error:')) throw new Error(`editTodoTitle failed: ${resp}`);
  await this.flutterDesktop.waitFor(byText(newTitle));
  this.data.lastTodoTitle = newTitle;
});

When('I delete the todo {string} via the Flutter desktop app', TIMEOUT, async function (this: ConductorWorld, title: string) {
  const resp = await this.flutterDesktop.requestData(
    JSON.stringify({ action: 'deleteTodo', title }),
    15000
  );
  if (resp.startsWith('error:')) throw new Error(`deleteTodo failed: ${resp}`);
  await this.flutterDesktop.waitForAbsent(byText(title));
});

Then('the Flutter desktop app shows {string}', TIMEOUT, async function (this: ConductorWorld, text: string) {
  await this.flutterDesktop.waitFor(byText(text));
});

Then('the Flutter desktop app does not show {string}', TIMEOUT, async function (this: ConductorWorld, text: string) {
  await this.flutterDesktop.waitForAbsent(byText(text));
});

Then('I take a Flutter desktop screenshot {string}', TIMEOUT, async function (this: ConductorWorld, name: string) {
  const slug = name.replace(/\s+/g, '-').toLowerCase();
  try {
    const screenshotPath = await this.flutterDesktop.takeScreenshot(slug);
    await this.attach(fs.readFileSync(screenshotPath), 'image/png');
  } catch (e: any) {
    this.logger.warn({ error: e.message }, 'Flutter desktop screenshot failed');
  }
});
