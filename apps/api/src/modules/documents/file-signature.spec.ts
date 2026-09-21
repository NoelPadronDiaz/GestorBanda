import { contentDisposition } from './storage.service';
import { detectMimeType } from './file-signature';

describe('detectMimeType', () => {
  it('recognizes allowed types by magic bytes', () => {
    expect(detectMimeType(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
    expect(detectMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      'image/png',
    );
    expect(detectMimeType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
  });

  it('rejects everything else, whatever the extension claims', () => {
    expect(detectMimeType(Buffer.from('MZ\x90\x00'))).toBeNull();
    expect(detectMimeType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(detectMimeType(Buffer.alloc(0))).toBeNull();
  });
});

describe('contentDisposition', () => {
  it('encodes non-ASCII names and never breaks out of the header', () => {
    const header = contentDisposition('Partitura "Pasodoble" ñ.pdf');
    expect(header).toContain('attachment;');
    expect(header).toContain("filename*=UTF-8''Partitura%20%22Pasodoble%22%20%C3%B1.pdf");
    expect(header).not.toMatch(/filename="[^"]*"[^;]*"/);
  });
});
