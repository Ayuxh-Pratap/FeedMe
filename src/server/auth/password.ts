import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto"

const KEY_LENGTH = 64
const SCRYPT_N = 131072
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024

function scrypt(
  password: string,
  salt: string,
  options: Pick<ScryptOptions, "N" | "r" | "p">
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      { ...options, maxmem: SCRYPT_MAX_MEMORY },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }

        resolve(derivedKey as Buffer)
      }
    )
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url")
  const hash = await scrypt(password, salt, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })

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

  const parsedN = Number(n)
  const parsedR = Number(r)
  const parsedP = Number(p)

  if (
    !Number.isInteger(parsedN) ||
    !Number.isInteger(parsedR) ||
    !Number.isInteger(parsedP) ||
    parsedN < 16384 ||
    parsedN > SCRYPT_N ||
    parsedR < 1 ||
    parsedR > 16 ||
    parsedP < 1 ||
    parsedP > 4
  ) {
    return false
  }

  const derivedHash = await scrypt(password, salt, {
    N: parsedN,
    r: parsedR,
    p: parsedP,
  })
  const storedHashBuffer = Buffer.from(storedHash, "base64url")

  if (derivedHash.length !== storedHashBuffer.length) {
    return false
  }

  return timingSafeEqual(derivedHash, storedHashBuffer)
}

export function passwordHashNeedsUpgrade(passwordHash: string) {
  const [algorithm, n, r, p] = passwordHash.split("$")

  return (
    algorithm !== "scrypt" ||
    Number(n) !== SCRYPT_N ||
    Number(r) !== SCRYPT_R ||
    Number(p) !== SCRYPT_P
  )
}
