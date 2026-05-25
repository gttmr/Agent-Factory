export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code !== "ERR_MODULE_NOT_FOUND" ||
      !specifier.startsWith(".") ||
      /\.[cm]?[jt]sx?$|\.json$/.test(specifier)
    ) {
      throw error;
    }

    for (const extension of [".ts", ".tsx", ".json"]) {
      try {
        return await nextResolve(`${specifier}${extension}`, context);
      } catch {
        // Try the next extension.
      }
    }
    throw error;
  }
}
