export class Config {
    private password_secret: string;
    private allow_remote_access: boolean;
    private image: ConfigImage;
    private installed: boolean;

    constructor(
        password_secret?: string,
        allow_remote_access?: boolean,
        image?: ConfigImage,
        installed?: boolean
    ) {
        this.password_secret = password_secret || null;
        this.allow_remote_access = allow_remote_access;
        this.image = image || {
            width: 350,
            height: 350,
            quality: 70,
        }
        this.installed = installed;
    }
}

export interface ConfigImage {
    width: number;
    height: number;
    quality: number;
}