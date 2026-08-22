if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is not set. Refusing to start without it — " +
      "falling back to a hardcoded value would let anyone who reads the source forge session tokens."
  );
}

export const JWT_SECRET_BYTES = new TextEncoder().encode(process.env.JWT_SECRET);
