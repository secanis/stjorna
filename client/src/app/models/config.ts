export class Config {
    password_secret: string;
    allow_remote_access: boolean;
    image: ConfigImage;
    installed: boolean;
    modules: ConfigModules;

    constructor(
        password_secret?: string,
        allow_remote_access?: boolean,
        image?: ConfigImage,
        installed?: boolean,
        modules?: ConfigModules,
    ) {
        this.password_secret = password_secret || null;
        this.allow_remote_access = allow_remote_access;
        this.image = image || {
            width: 350,
            height: 350,
            quality: 70,
        }
        this.installed = installed;
        this.modules = modules
    }
}

export interface ConfigImage {
    width: number;
    height: number;
    quality: number;
}

export interface ConfigModules {
    services: boolean
}
