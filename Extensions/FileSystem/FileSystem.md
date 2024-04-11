# FileSystem

This extension allows file system access on the local machine. It uses the
*Node.js* [file system](https://nodejs.org/api/fs.html) module to access local
files.

## API Reference

This reference assumes the extension is used with the `fs` name. All file paths
can be relative to the extension directory or absolute. The following messages
can be sent to the extension. The keys of the `args` object and their types and
purpose are listed below the messages:

### `fs.readFile`

- `path`: `<string>`\
  Path of the file to read
- `encoding?`: `<string>`\
  [Encoding](https://nodejs.org/api/buffer.html#buffers-and-character-encodings)
  of the returned string. If `null` or omitted, the method returns a buffer.
- Returns: `<string>` | `<buffer>`\
  The file contents

### `fs.writeFile`

- `path`: `<string>`\
  Path of the file to write
- `data`: `<string>` | `<buffer>`\
  Data to write to the file
- `flag?`: `<string>`\
  See *Node.js*
  [file system flags](https://nodejs.org/api/fs.html#file-system-flags).
  The default value is `'w'`.
- `encoding?`: `<string>`\
  [Encoding](https://nodejs.org/api/buffer.html#buffers-and-character-encodings)
  of the input data. The default value is `'utf8'`.

### `fs.mkdir`

- `path`: `<string>`\
  Path of the directory to create
- `recursive?`: `<boolean>`\
  `true` to create missing directories recursively. The default value is
  `false`.

### `fs.readdir`

- `path`: `<string>`\
  Path of the directory to read
- `encoding?`: `<string>`\
  If set to `'buffer'`, the returned filenames are passed as `<Buffer>`
  objects. The default value is `utf8`.
- `withFileTypes?`: `<boolean>`\
  `true` to return a list of [`<directoryEntry>`](#directoryentry) objects
- `recursive?`: `<boolean>`\
  `true` to list all files in subdirectories as well
- Returns: `<string[]>` | [`<directoryEntry>[]`](#directoryentry)\
  A list of all files in the directory

### `fs.exists`

- `path`: `<string>`\
  Path to check
- Returns: `<boolean>`\
  A value that indicates whether the path exists

### `fs.rename`

- `oldPath`: `<string>`\
  Current path of the file or directory
- `newPath`: `<string>`\
  New path of the file or directory

### `fs.rm`

- `path`: `<string>`\
  Path to remove
- `recursive?`: `<boolean>`\
  `true` to remove all subpaths recursively, which is required to remove
  directories

---

### `directoryEntry`

Return value of [`fs.readdir`](#fsreaddir).

- `parentPath`: `<string>`\
  Path of the directory containing the entry
- `name`: `<string>`\
  Name of the entry
- `type`: `<string>`\
  Type of the entry, which can be one of the following:
  - `"file"`
  - `"directory"`
  - `"symlink"`
  - `"blockDevice"`
  - `"characterDevice"`
  - `"fifo"`
  - `"socket"`
