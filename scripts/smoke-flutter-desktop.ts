/* eslint-disable */
// Quick smoke for FlutterDesktopDriver. Not a unit test — manual sanity check.
import { config } from '../config';
import { FlutterDesktopDriver } from '../src/drivers/FlutterDesktopDriver';

(async () => {
  process.env.DEBUG_FLUTTER_DESKTOP = '1';
  const driver = new FlutterDesktopDriver(config);
  try {
    await driver.launch();
    console.log('[smoke] launched ok');

    await driver.waitFor({ type: 'ByText', value: 'My Todos' }, 15000);
    console.log('[smoke] saw AppBar title');

    const shot = await driver.takeScreenshot('smoke-flutter-desktop');
    console.log('[smoke] screenshot:', shot);
  } catch (err) {
    console.error('[smoke] FAILED:', err);
    process.exitCode = 1;
  } finally {
    await driver.close();
  }
})();
