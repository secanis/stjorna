import nock from 'nock';

const S3_BUCKET = 'test-bucket';
const S3_REGION = 'eu-central-1';
const S3_BASE_URL = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

export function mockS3PresignUpload(): nock.Scope {
  return nock(S3_BASE_URL)
    .filteringPath(() => '/')
    .put('/')
    .reply(200, '', {
      'ETag': '"d41d8cd98f00b204e9800998ecf8427e"',
      'Location': 'https://test-bucket.s3.eu-central-1.amazonaws.com/test-key',
    });
}

export function mockS3PresignDownload(key: string): nock.Scope {
  return nock(S3_BASE_URL)
    .get('/' + key.replace(/\//g, '%2F'))
    .reply(200, 'mock-file-content', {
      'Content-Type': 'image/jpeg',
      'Content-Length': '1234',
      'ETag': '"d41d8cd98f00b204e9800998ecf8427e"',
    });
}

export function mockS3UploadSuccess(key: string): nock.Scope {
  return nock(S3_BASE_URL)
    .put('/' + key.replace(/\//g, '%2F'))
    .reply(200, '', {
      'ETag': '"abc123"',
      'x-amz-id-2': 'test-id',
      'x-amz-request-id': 'test-request-id',
    });
}

export function mockS3DownloadSuccess(key: string, body: string = 'mock file content'): nock.Scope {
  return nock(S3_BASE_URL)
    .get('/' + key.replace(/\//g, '%2F'))
    .reply(200, body, {
      'Content-Type': 'image/jpeg',
      'Content-Length': body.length.toString(),
      'ETag': '"mock-etag"',
    });
}

export function mockS3HeadObject(key: string, exists: boolean = true): nock.Scope {
  const path = '/' + key.replace(/\//g, '%2F');
  if (exists) {
    return nock(S3_BASE_URL)
      .head(path)
      .reply(200, '', {
        'Content-Type': 'image/jpeg',
        'ETag': '"mock-etag"',
        'Last-Modified': new Date().toISOString(),
      });
  }
  return nock(S3_BASE_URL)
    .head(path)
    .reply(404, '', {
      'x-amz-error-code': 'NoSuchKey',
      'x-amz-error-message': 'The specified key does not exist.',
    });
}

export function mockS3ListObjects(prefix: string, keys: string[]): nock.Scope {
  return nock(S3_BASE_URL)
    .get('/')
    .query({ 'prefix': prefix })
    .reply(200, `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${S3_BUCKET}</Name>
  <Prefix>${prefix}</Prefix>
  ${keys.map(k => `<Contents><Key>${k}</Key><Size>1234</Size></Contents>`).join('\n  ')}
</ListBucketResult>`);
}

export function disableNet(): void {
  nock.disableNetConnect();
}

export function enableNet(): void {
  nock.enableNetConnect();
}

export function cleanAll(): void {
  nock.cleanAll();
}

export function getS3BaseUrl(): string {
  return S3_BASE_URL;
}

export function getS3Bucket(): string {
  return S3_BUCKET;
}

export function getS3Region(): string {
  return S3_REGION;
}