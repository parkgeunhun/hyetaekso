import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';

const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const baseURL='http://127.0.0.1:5175';
process.env.BROWSER_TEST_PASSWORD??=randomBytes(24).toString('hex');
export default defineConfig({
  testDir:'./tests/browser',
  timeout:140000,
  expect:{timeout:18000},
  use:{baseURL,browserName:'chromium',launchOptions:existsSync(edge)?{executablePath:edge}:{},trace:'retain-on-failure'},
  workers:1,
  webServer:{command:'node scripts/browser-server.mjs',url:baseURL,timeout:90000,reuseExistingServer:false}
});
