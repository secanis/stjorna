export class Config {
    private password_secret: string;
    private allow_remote_access: boolean;
    private image_dimension: number;
    private image_quality: number;
    private installed: boolean;

    constructor(
        password_secret?: string,
        allow_remote_access?: boolean,
        image_dimension?: number,
        image_quality?: number,
        installed?: boolean
    ) {
        this.password_secret = password_secret || null;
        this.allow_remote_access = allow_remote_access;
        this.image_dimension = image_dimension || 0;
        this.image_quality = image_quality || 0;
        this.installed = installed;
    }
}
