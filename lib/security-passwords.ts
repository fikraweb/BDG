// The portable Node build overrides this adapter to support its initial scrypt hash.
export async function verifyLegacyAdminPassword(_password:string,_encoded:string):Promise<boolean>{return false;}
