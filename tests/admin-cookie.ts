import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { makeToken } from "@/lib/crypto";
console.log(makeToken("a", "admin", 3600));
