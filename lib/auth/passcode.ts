import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPasscode(passcode: string): Promise<string> {
  return bcrypt.hash(passcode, ROUNDS);
}

export async function verifyPasscode(
  passcode: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(passcode, hash);
}
