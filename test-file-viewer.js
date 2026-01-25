import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Array to collect console messages and errors
  const consoleMessages = [];
  const consoleErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`Page Error: ${error.message}`);
  });

  try {
    console.log('Step 1: Navigating to http://localhost:5174');
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tmp/step1-home-page.png', fullPage: true });
    console.log('✓ Screenshot saved: tmp/step1-home-page.png');

    console.log('\nStep 2: Looking for projects to click...');
    await page.waitForSelector('a[href*="/sessions"]', { timeout: 5000 });
    const projectLinks = await page.$$('a[href*="/sessions"]');
    console.log(`Found ${projectLinks.length} project links`);

    if (projectLinks.length > 0) {
      const firstProject = projectLinks[0];
      const projectText = await firstProject.textContent();
      console.log(`Clicking on project: ${projectText?.trim()}`);
      await firstProject.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'tmp/step2-sessions-list.png', fullPage: true });
      console.log('✓ Screenshot saved: tmp/step2-sessions-list.png');
    } else {
      console.log('✗ No projects found');
      await browser.close();
      return;
    }

    console.log('\nStep 3: Looking for a session to click...');
    const sessionLinks = await page.$$('a[href*="/sessions/"]:not([href$="/sessions"])');
    console.log(`Found ${sessionLinks.length} session links`);

    if (sessionLinks.length > 0) {
      const firstSession = sessionLinks[0];
      const sessionText = await firstSession.textContent();
      console.log(`Clicking on session: ${sessionText?.trim().substring(0, 50)}...`);
      await firstSession.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Wait for any animations
      await page.screenshot({ path: 'tmp/step3-session-details.png', fullPage: true });
      console.log('✓ Screenshot saved: tmp/step3-session-details.png');
    } else {
      console.log('✗ No sessions found');
      await browser.close();
      return;
    }

    console.log('\nStep 4: Looking for Files tab...');
    // Look for the Files tab button
    const filesTabSelector = 'button:has-text("Files"), [role="tab"]:has-text("Files")';
    const filesTab = await page.$(filesTabSelector);

    if (filesTab) {
      const tabText = await filesTab.textContent();
      console.log(`Found Files tab: ${tabText?.trim()}`);
      await filesTab.click();
      await page.waitForTimeout(1000); // Wait for tab content to render
      await page.screenshot({ path: 'tmp/step4-files-tab.png', fullPage: true });
      console.log('✓ Screenshot saved: tmp/step4-files-tab.png');

      console.log('\nStep 5: Looking for .md files in the grid...');
      const mdFileButtons = await page.$$('button:has-text(".md"), [role="button"]:has-text(".md")');
      console.log(`Found ${mdFileButtons.length} .md file buttons`);

      if (mdFileButtons.length > 0) {
        const firstMdFile = mdFileButtons[0];
        const fileName = await firstMdFile.textContent();
        console.log(`Clicking on file: ${fileName?.trim()}`);
        await firstMdFile.click();
        await page.waitForTimeout(1000); // Wait for modal to appear
        await page.screenshot({ path: 'tmp/step5-file-viewer-modal.png', fullPage: true });
        console.log('✓ Screenshot saved: tmp/step5-file-viewer-modal.png');

        console.log('\nStep 6: Closing the modal...');
        // Try to find and click close button
        const closeButton = await page.$('button:has-text("Close"), [aria-label="Close"], button:has-text("×")');
        if (closeButton) {
          await closeButton.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: 'tmp/step6-modal-closed.png', fullPage: true });
          console.log('✓ Screenshot saved: tmp/step6-modal-closed.png');
        } else {
          // Try pressing Escape key
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          await page.screenshot({ path: 'tmp/step6-modal-closed-esc.png', fullPage: true });
          console.log('✓ Screenshot saved: tmp/step6-modal-closed-esc.png (used Escape key)');
        }
      } else {
        console.log('✗ No .md files found in the Files tab');
        await page.screenshot({ path: 'tmp/step5-no-md-files.png', fullPage: true });
        console.log('✓ Screenshot saved: tmp/step5-no-md-files.png');
      }
    } else {
      console.log('✗ Files tab not found');
      // Take screenshot showing what tabs are available
      await page.screenshot({ path: 'tmp/step4-no-files-tab.png', fullPage: true });
      console.log('✓ Screenshot saved: tmp/step4-no-files-tab.png');
    }

    console.log('\n=== CONSOLE MESSAGES ===');
    if (consoleMessages.length > 0) {
      consoleMessages.forEach((msg, i) => {
        console.log(`[${msg.type.toUpperCase()}] ${msg.text}`);
      });
    } else {
      console.log('No console messages');
    }

    console.log('\n=== CONSOLE ERRORS ===');
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((err, i) => {
        console.log(`Error ${i + 1}: ${err}`);
      });
    } else {
      console.log('No console errors found! ✓');
    }

  } catch (error) {
    console.error('\n✗ Test failed with error:', error.message);
    await page.screenshot({ path: 'tmp/error-screenshot.png', fullPage: true });
    console.log('✓ Error screenshot saved: tmp/error-screenshot.png');
  } finally {
    await browser.close();
    console.log('\nBrowser closed. Test complete.');
  }
})();
