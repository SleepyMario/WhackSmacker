import {
  assertDatabaseReady,
  createDatabasePool,
  createUser,
  databaseConfig,
  databaseMigrationStatus,
  hashPassword,
  installedMigrationDirectory,
  migrateDatabase,
  normalizeUsername,
  revokeUserSessions
} from "../../packages/storage/postgres";

export const adminUsage = "Usage:\n  whacksmacker admin db migrate|status\n  whacksmacker admin user create|list|disable|enable|reset-password|revoke-sessions USERNAME [--role admin|user] [--password-stdin]";

export async function runAdmin(args:readonly string[]){
  const config=databaseConfig();
  if(!config)throw new Error("DATABASE_URL is required for admin operations.");
  const pool=createDatabasePool(config);
  try{
    await assertDatabaseReady(pool);
    if(args[0]==="db"){
      const migrations=installedMigrationDirectory();
      if(args[1]==="migrate"){
        for(const version of await migrateDatabase(pool,migrations))console.log("Applied "+version);
        return;
      }
      if(args[1]==="status"){
        for(const migration of await databaseMigrationStatus(pool,migrations))console.log((migration.applied?"applied ":"pending ")+migration.version);
        return;
      }
    }
    if(args[0]!=="user"||!args[1])throw new Error(adminUsage);
    const operation=args[1],username=args[2];
    if(operation==="list"){
      const result=await pool.query("SELECT display_username,role,enabled,created_at,last_login_at FROM users ORDER BY normalized_username");
      for(const user of result.rows)console.log([user.display_username,user.role,user.enabled?"enabled":"disabled",user.last_login_at??"never"].join("\t"));
      return;
    }
    if(!username)throw new Error("USERNAME is required.");
    const normalized=normalizeUsername(username);
    if(operation==="create"){
      const role=(option(args,"--role")??"user") as "admin"|"user";
      if(role!=="admin"&&role!=="user")throw new Error("--role must be admin or user.");
      const user=await createUser(pool,username,await passwordInput(args),role);
      console.log("Created "+user.username+" ("+user.role+")");
      return;
    }
    const result=await pool.query<{id:string}>("SELECT id FROM users WHERE normalized_username=$1",[normalized]);
    if(!result.rows[0])throw new Error("User not found.");
    const userId=result.rows[0].id;
    if(operation==="disable"||operation==="enable"){
      await pool.query("UPDATE users SET enabled=$1,updated_at=now() WHERE id=$2",[operation==="enable",userId]);
      if(operation==="disable")await revokeUserSessions(pool,userId);
      console.log(operation==="enable"?"Enabled.":"Disabled.");
      return;
    }
    if(operation==="revoke-sessions"){
      await revokeUserSessions(pool,userId);
      console.log("Sessions revoked.");
      return;
    }
    if(operation==="reset-password"){
      const hash=await hashPassword(await passwordInput(args));
      await pool.query("UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2",[hash,userId]);
      await revokeUserSessions(pool,userId);
      console.log("Password reset and sessions revoked.");
      return;
    }
    throw new Error(adminUsage);
  }finally{
    await pool.end();
  }
}

function option(args:readonly string[],name:string){const index=args.indexOf(name);return index<0?undefined:args[index+1]}
async function passwordInput(args:readonly string[]){
  if(args.includes("--password-stdin")){
    const chunks:Buffer[]=[];
    for await(const chunk of process.stdin)chunks.push(Buffer.from(chunk));
    const password=Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/u,"");
    if(!password)throw new Error("Empty password.");
    return password;
  }
  if(!process.stdin.isTTY)throw new Error("Use --password-stdin when stdin is not a terminal.");
  const password=await hidden("Password: "),confirmation=await hidden("Confirm password: ");
  if(password!==confirmation)throw new Error("Passwords do not match.");
  return password;
}
function hidden(prompt:string):Promise<string>{
  return new Promise((resolve,reject)=>{
    process.stdout.write(prompt);let value="";process.stdin.setRawMode(true);process.stdin.resume();
    const cleanup=()=>{process.stdin.off("data",onData);process.stdin.setRawMode(false);process.stdin.pause()};
    const onData=(buffer:Buffer)=>{for(const character of buffer){if(character===3){cleanup();reject(new Error("Cancelled."));return}if(character===13||character===10){cleanup();process.stdout.write("\n");resolve(value);return}if(character===127){value=value.slice(0,-1);continue}value+=String.fromCharCode(character)}};
    process.stdin.on("data",onData);
  });
}
