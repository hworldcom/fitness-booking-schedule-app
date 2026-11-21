// MOV-259: actual uploader/routes/normalizers with explicit fictional Auth and memory persistence.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { chromium, webkit, expect } from "@playwright/test";
const root = process.cwd(),
  scratch = await mkdtemp(path.join(tmpdir(), "mov259-images-")),
  port = 3204,
  base = `http://localhost:${port}`,
  output = path.join(root, "test-results/mov259/browser");
let server,
  log = "";
const checks = [],
  errors = [];
const write = async (file, text) => {
  await mkdir(path.dirname(path.join(scratch, file)), { recursive: true });
  await writeFile(path.join(scratch, file), text);
};
try {
  await mkdir(output, { recursive: true });
  for (const file of [
    "src",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, file), path.join(scratch, file), {
      recursive: true,
    });
  await symlink(
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
    "dir",
  );
  const styles = (await readFile(path.join(root, "src/app/layout.tsx"), "utf8"))
    .split("\n")
    .filter((x) => /^import ".*(?:\.css|@fontsource[^\"]*)";$/.test(x));
  await write(
    "src/app/layout.tsx",
    `${styles.join("\n")}\nexport default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><main style={{padding:24,maxWidth:1100,margin:'auto'}}>{children}</main></body></html>}`,
  );
  await cp(
    path.join(root, "tests/fixtures/profile-image-compatibility-ui.tsx"),
    path.join(scratch, "src/app/page.tsx"),
  );
  await write(
    "src/auth/client/actor-provider.tsx",
    `"use client";export function useActor(){return {actor:{status:"authorized",profile:{coachPortraitUrl:null}},refreshActor:async()=>{}};}`,
  );
  await write(
    "src/server/profile-images/service.ts",
    `import sharp from 'sharp';import{normalizeCanonicalProfileImage}from './image-normalization';
 type State={images:Map<string,Uint8Array>,events:object[],mode:string};const global=globalThis as typeof globalThis&{mov259?:State};const state=()=>global.mov259??=( {images:new Map(),events:[],mode:'ready'} );
 async function upload(kind:string,input:Uint8Array){if(state().mode==='reject')return{status:'invalid' as const,imageUrl:null};try{const source=await sharp(input).metadata();const result=await normalizeCanonicalProfileImage(input);const meta=await sharp(result.bytes).metadata();state().images.set(kind,result.bytes);state().events.push({kind,inputFormat:source.format,inputBytes:input.length,storedFormat:meta.format,bytes:result.bytes.length,width:meta.width,height:meta.height,hasMetadata:Boolean(meta.exif||meta.icc||meta.xmp)});return{status:'saved' as const,imageUrl:'/fixture/image?kind='+kind+'&v='+state().events.length};}catch{return{status:'invalid' as const,imageUrl:null};}}
 export const uploadCurrentAccountAvatar=(bytes:Uint8Array)=>upload('account',bytes);export const uploadCurrentCoachPortrait=(bytes:Uint8Array)=>upload('coach',bytes);
 export async function currentAccountAvatarBytes(){const bytes=state().images.get('account');return bytes?{status:'ready' as const,bytes}:{status:'not-found' as const};}
 export async function removeCurrentAccountAvatar(){state().images.delete('account');return{status:'removed' as const,imageUrl:null};}export async function removeCurrentCoachPortrait(){state().images.delete('coach');return{status:'removed' as const,imageUrl:null};}
 export function fixture(){return state();}`,
  );
  await write(
    "src/app/fixture/image/route.ts",
    `import{fixture}from '@/server/profile-images/service';export async function GET(req:Request){const bytes=fixture().images.get(new URL(req.url).searchParams.get('kind')??'');return new Response(bytes??null,{status:bytes?200:404,headers:{'content-type':'image/webp','cache-control':'no-store'}});}`,
  );
  await write(
    "src/app/fixture/state/route.ts",
    `import{fixture}from '@/server/profile-images/service';export async function GET(){return Response.json({events:fixture().events},{headers:{'cache-control':'no-store'}});}export async function POST(req:Request){fixture().mode=(await req.json()).mode;return Response.json({ok:true});}`,
  );
  await write(
    "src/proxy.ts",
    `import{NextResponse}from'next/server';export function proxy(){return NextResponse.next();}`,
  );
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) =>
        !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|MUX|RESEND|SMTP|CRON_SECRET/.test(
          k,
        ),
    ),
  );
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "localhost",
      "--port",
      String(port),
    ],
    {
      cwd: scratch,
      env: {
        ...env,
        NEXT_PUBLIC_SITE_URL: base,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "mov259-fictional-key",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (b) => (log += b));
  const deadline = Date.now() + 60000;
  while (
    !log.includes("Ready") &&
    Date.now() < deadline &&
    server.exitCode === null
  )
    await new Promise((r) => setTimeout(r, 200));
  assert.ok(log.includes("Ready"), "Owned fixture did not start");
  // Compile owned API modules before timing interactive upload assertions.
  for (const [route, status] of [
    ["/api/profile/avatar", 404],
    ["/api/coach/portrait", 405],
    ["/fixture/state", 200],
    ["/fixture/image?kind=none", 404],
  ]) {
    const response = await fetch(base + route, {
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, status);
    await response.body?.cancel();
  }
  const inputs = [];
  for (const format of ["png", "jpeg", "webp"])
    inputs.push({
      name: "tiny." + format,
      mimeType: "image/" + format,
      buffer: await sharp({
        create: { width: 16, height: 16, channels: 3, background: "#356da4" },
      })
        .toFormat(format)
        .toBuffer(),
    });
  for (const [name, engine, opts] of [
    ["Chrome", chromium, { channel: "chrome" }],
    ["WebKit", webkit, {}],
  ]) {
    const browser = await engine.launch({ headless: true, ...opts });
    try {
      const page = await browser.newPage();
      page.on("pageerror", (e) => errors.push(name + ": " + e.message));
      const posts = [];
      page.on("request", (r) => {
        if (
          r.method() === "POST" &&
          /\/api\/(profile\/avatar|coach\/portrait)$/.test(r.url())
        )
          posts.push({
            url: r.url(),
            mime: r.headers()["content-type"],
            bytes: r.postDataBuffer()?.length,
          });
      });
      const state = async () =>
        await (await fetch(base + "/fixture/state")).json();
      for (const width of [1440, 375, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(base, { waitUntil: "networkidle" });
        for (const index of [0, 1]) {
          const panel = page.locator(".profile-image-uploader").nth(index),
            input = panel.locator("input[type=file]"),
            kind = index ? "coach" : "account";
          for (const file of inputs) {
            await input.focus();
            await expect(input).toBeFocused();
            await input.setInputFiles(file);
            await expect(panel.getByRole("status")).toContainText(
              index ? "Public coach portrait saved." : "Account avatar saved.",
            );
            const event = (await state()).events.at(-1);
            assert.equal(event.kind, kind);
            assert.equal(event.storedFormat, "webp");
            assert.equal(event.width, 512);
            assert.equal(event.height, 512);
            assert.equal(event.hasMetadata, false);
            assert.ok(event.bytes <= 512 * 1024);
            assert.equal(
              posts.at(-1).mime,
              name === "WebKit" ? "image/jpeg" : "image/webp",
            );
            assert.ok(event.inputBytes <= 512 * 1024);
            assert.equal(event.inputFormat, posts.at(-1).mime.split("/")[1]);
          }
          const previous = await panel.locator("img").getAttribute("src"),
            before = (await state()).events.length;
          await fetch(base + "/fixture/state", {
            method: "POST",
            body: JSON.stringify({ mode: "reject" }),
          });
          await input.setInputFiles(inputs[0]);
          await expect(panel.getByRole("alert")).toContainText(
            "previous image is unchanged",
          );
          assert.equal((await state()).events.length, before);
          assert.equal(
            await panel.locator("img").getAttribute("src"),
            previous,
          );
          await fetch(base + "/fixture/state", {
            method: "POST",
            body: JSON.stringify({ mode: "ready" }),
          });
        }
        const panel = page.locator(".profile-image-uploader").first(),
          input = panel.locator("input[type=file]");
        let count = posts.length;
        await page.evaluate(() => {
          globalThis.mov259Original = HTMLCanvasElement.prototype.toBlob;
          HTMLCanvasElement.prototype.toBlob = function (cb) {
            cb(null);
          };
        });
        await input.setInputFiles(inputs[0]);
        await expect(panel.getByRole("alert")).toContainText(
          "Your browser could not prepare this image",
        );
        assert.equal(posts.length, count);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page.screenshot({
          path: path.join(output, name + "-" + width + "-conversion-error.png"),
          fullPage: true,
        });
        await page.evaluate(() => {
          HTMLCanvasElement.prototype.toBlob = function (cb, type) {
            cb(new Blob([new Uint8Array(512 * 1024 + 1)], { type }));
          };
        });
        await input.setInputFiles(inputs[0]);
        await expect(panel.getByRole("alert")).toContainText(
          "prepared image exceeds 512 KB",
        );
        assert.equal(posts.length, count);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page.screenshot({
          path: path.join(output, name + "-" + width + "-size-error.png"),
          fullPage: true,
        });
        await page.evaluate(() => {
          HTMLCanvasElement.prototype.toBlob = function (cb) {
            return globalThis.mov259Original.call(this, cb, "image/png");
          };
        });
        await input.setInputFiles(inputs[0]);
        await expect(panel.getByRole("status")).toContainText(
          "Account avatar saved.",
        );
        assert.equal(posts.at(-1).mime, "image/png");
        await page.evaluate(() => {
          HTMLCanvasElement.prototype.toBlob = globalThis.mov259Original;
        });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page.screenshot({
          path: path.join(output, name + "-" + width + ".png"),
          fullPage: true,
        });
        const remove = panel.getByRole("button", {
          name: "Remove",
          exact: false,
        });
        await remove.focus();
        await page.keyboard.press("Enter");
        await expect(panel.getByRole("status")).toContainText(
          "Account avatar removed.",
        );
        checks.push({
          browser: name,
          width,
          formats: 3,
          uploadPaths: 2,
          realEncoding: name === "WebKit" ? "jpeg fallback" : "webp",
          canonicalWebp: true,
          formatVsSizeErrors: true,
          pngOnlySimulation: true,
          priorImagePreserved: true,
          keyboard: true,
          overflow: false,
        });
        console.log(
          "PASS " +
            name +
            " " +
            width +
            "px: actual encoder/route/Sharp pipeline, both paths, original tiny images, accurate failures and prior-image preservation.",
        );
      }
      await page.close();
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "result.json"),
    JSON.stringify(
      {
        passed: true,
        checks,
        errors,
        proof:
          "Actual components/routes/browser encoders/Sharp; fictional actor and memory persistence, no real Auth/SQL/Storage or iPhone hardware certification.",
      },
      null,
      2,
    ),
  );
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((r) => {
      server.once("exit", r);
      setTimeout(r, 5000);
    });
  }
  await writeFile(path.join(output, "server.log"), log).catch(() => {});
  assert.ok(scratch.includes("mov259-images-"));
  await rm(scratch, { recursive: true, force: true });
}
