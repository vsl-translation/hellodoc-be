export default () => ({
    jwt: {
        secret: process.env.JWT_SECRET,
    },
    database: {
        connectionString: process.env.MONGO_URL
    },
    media: {
        upload_root: process.env.UPLOAD_ROOT || 'uploads',
        base_url: process.env.MEDIA_BASE_URL || 'http://localhost:4000',
    }
});