import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto"

const KEY_LENGTH = 64
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_OPTIONS: ScryptOptions = {
  N: SCRYPT_N,
  r: SCRYPT_R,
  p: SCRYPT_P,
}

function scrypt(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) {
        reject(error)
        return
      }

      resolve(derivedKey as Buffer)
    })
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url")
  const hash = await scrypt(password, salt)

  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt,
    hash.toString("base64url"),
  ].join("$")
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, n, r, p, salt, storedHash] = passwordHash.split("$")

  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !storedHash) {
    return false
  }

  const derivedHash = await scrypt(password, salt)
  const storedHashBuffer = Buffer.from(storedHash, "base64url")

  if (derivedHash.length !== storedHashBuffer.length) {
    return false
  }

  return timingSafeEqual(derivedHash, storedHashBuffer)
}
