// MOV-86 extends the accepted approval journey with bell/cron/Mailpit proof.
process.argv.push("--group-notifications");
await import("./rehearse-group-approvals-integration.mjs");
