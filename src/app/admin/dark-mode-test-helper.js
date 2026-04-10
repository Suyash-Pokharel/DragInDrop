/**
 * Dark Mode Verification Helper Script
 * 
 * Run this script in the browser console while on the /admin page
 * to verify dark mode support.
 * 
 * Usage:
 * 1. Navigate to /admin as an admin user
 * 2. Open browser DevTools (F12)
 * 3. Copy and paste this entire script into the console
 * 4. Press Enter to run
 */

(function() {
  console.log('🎨 Dark Mode Verification Helper');
  console.log('================================\n');

  // Check if we're on the admin page
  if (!window.location.pathname.includes('/admin')) {
    console.error('❌ Please navigate to /admin first');
    return;
  }

  // Function to get CSS variable value
  function getCSSVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  // Function to check if dark mode is active
  function isDarkMode() {
    return document.documentElement.classList.contains('dark');
  }

  // Function to verify CSS variables
  function verifyCSSVariables() {
    const mode = isDarkMode() ? 'Dark' : 'Light';
    console.log(`\n📊 CSS Variables (${mode} Mode):`);
    console.log('─────────────────────────────');
    
    const variables = [
      '--background',
      '--surface',
      '--surface-highlight',
      '--text-main',
      '--text-secondary',
      '--border',
      '--primary',
      '--error'
    ];

    variables.forEach(varName => {
      const value = getCSSVar(varName);
      const status = value ? '✅' : '❌';
      console.log(`${status} ${varName}: ${value || 'NOT FOUND'}`);
    });
  }

  // Function to verify component classes
  function verifyComponentClasses() {
    console.log('\n🔍 Component Class Verification:');
    console.log('─────────────────────────────────');

    const checks = [
      { selector: '.bg-background', name: 'Background containers' },
      { selector: '.bg-surface', name: 'Surface containers' },
      { selector: '.border-border', name: 'Borders' },
      { selector: '.text-text-main', name: 'Primary text' },
      { selector: '.text-text-secondary', name: 'Secondary text' },
      { selector: '.hover\\:bg-surface-highlight', name: 'Hover states' }
    ];

    checks.forEach(check => {
      const elements = document.querySelectorAll(check.selector);
      const status = elements.length > 0 ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${elements.length} elements`);
    });
  }

  // Function to verify chart colors
  function verifyChartColors() {
    console.log('\n📈 Chart Color Verification:');
    console.log('────────────────────────────');

    const chart = document.querySelector('.recharts-wrapper');
    if (chart) {
      console.log('✅ Chart found');
      
      const line = chart.querySelector('.recharts-line-curve');
      if (line) {
        const stroke = line.getAttribute('stroke');
        console.log(`✅ Line stroke: ${stroke}`);
      }

      const axes = chart.querySelectorAll('.recharts-cartesian-axis-line');
      console.log(`✅ Axes found: ${axes.length}`);
    } else {
      console.log('⚠️  Chart not found (may not be visible)');
    }
  }

  // Function to verify modals
  function verifyModals() {
    console.log('\n🪟 Modal Verification:');
    console.log('─────────────────────');

    const backdrop = document.querySelector('.bg-black\\/50');
    if (backdrop) {
      console.log('✅ Modal backdrop found');
      const modal = document.querySelector('.bg-surface');
      if (modal) {
        console.log('✅ Modal surface found');
      }
    } else {
      console.log('ℹ️  No modals currently open');
    }
  }

  // Function to toggle theme
  function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      console.log('\n🌞 Switched to Light Mode');
    } else {
      html.classList.add('dark');
      console.log('\n🌙 Switched to Dark Mode');
    }
  }

  // Run all verifications
  function runAllChecks() {
    console.clear();
    console.log('🎨 Dark Mode Verification Helper');
    console.log('================================\n');
    console.log(`Current Mode: ${isDarkMode() ? '🌙 Dark' : '🌞 Light'}`);
    
    verifyCSSVariables();
    verifyComponentClasses();
    verifyChartColors();
    verifyModals();

    console.log('\n\n💡 Helper Functions:');
    console.log('────────────────────');
    console.log('• toggleTheme() - Toggle between light and dark mode');
    console.log('• runAllChecks() - Run all verification checks again');
    console.log('• verifyCSSVariables() - Check CSS variables');
    console.log('• verifyComponentClasses() - Check component classes');
    console.log('• verifyChartColors() - Check chart colors');
    console.log('• verifyModals() - Check modal elements');
  }

  // Make functions available globally
  window.darkModeHelper = {
    toggleTheme,
    runAllChecks,
    verifyCSSVariables,
    verifyComponentClasses,
    verifyChartColors,
    verifyModals,
    isDarkMode
  };

  // Run initial checks
  runAllChecks();

  console.log('\n\n🚀 Quick Test:');
  console.log('──────────────');
  console.log('Run: darkModeHelper.toggleTheme()');
  console.log('Then: darkModeHelper.runAllChecks()');
  console.log('To verify theme switching works correctly');
})();
