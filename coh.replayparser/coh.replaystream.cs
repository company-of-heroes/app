using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace CoH
{
   public class ReplayStream
	{
		FileStream fs;

      //********************************************************************************************************

      public long    position { get { return this.fs.Position; } }
      public long    length   { get { return this.fs.Length;   } }
      public string  MD5hash  { get; private set; }

		//********************************************************************************************************

      public ReplayStream(FileStream fileStream)
      {
         this.fs = fileStream;
            
         this.MD5hash = this.getMD5hash();

         this.seek(0);
      }

      public ReplayStream(string fileName)
         : this(new FileStream(fileName, FileMode.Open))
		{}

		public void close()
		{
			this.fs.Close();
		}

		//********************************************************************************************************

		public UInt16 readUInt16()
		{
			return BitConverter.ToUInt16(this.readBytes(2), 0);
		}

		//********************************************************************************************************

		public UInt32 readUInt32()
		{
			return BitConverter.ToUInt32(this.readBytes(4), 0);
		}

		//********************************************************************************************************

		public string readASCIIStr(UInt32 length)
		{
			return Encoding.ASCII.GetString(this.readBytes(length));
		}

		public string readASCIIStr()
		{
			return this.readASCIIStr(this.readUInt32());
		}

		//********************************************************************************************************

		public string readUnicodeStr(UInt32 length)
		{
			return Encoding.Unicode.GetString(readBytes(2 * length));
		}

		public string readUnicodeStr()
		{
			return this.readUnicodeStr(this.readUInt32());
		}

		//********************************************************************************************************

		public byte[] readBytes(UInt32 count)
		{
			byte[] data = new byte[count];
			this.fs.Read(data, 0, (int)count);
			return data;
		}

		//********************************************************************************************************

		public void skip(long I)
		{
			this.fs.Seek(I, SeekOrigin.Current);
		}

		//********************************************************************************************************

		public void seek(long I)
		{
			this.fs.Seek(I, SeekOrigin.Begin);
		}

		//********************************************************************************************************

		public UInt32 peek(long I)
		{
			long p = this.position;
			UInt32 retval = this.readUInt32();
			this.seek(p);
			return retval;
		}

		//********************************************************************************************************

      private string getMD5hash()
      {
         MD5 md5 = new MD5CryptoServiceProvider();
         StringBuilder s = new StringBuilder();

         byte[] b = md5.ComputeHash(fs);
         for (int i = 0; i < b.Length; ++i)
         {
            s.Append(b[i].ToString("X2"));
         }
         return s.ToString();
      }
   }
}
