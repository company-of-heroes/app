using System;
using System.Text.RegularExpressions;

namespace CoH
{
   public class ReplayParser
   {
		CoH.Replay replay;

      //********************************************************************************************************

		public CoH.Replay parse(string fileName, CoH.ActionDefinitions ad)
		{
			this.replay = new CoH.Replay(fileName, ad);
			return this.parse(replay, false);
		}

		public CoH.Replay parse(CoH.Replay replay, bool headerOnly)
		{
			this.replay = replay;

			if ( ! replay.headerParsed )
			{
				this.parseHeader();
			}
				
			if( ! headerOnly )
			{
				this.parseData();
			}

			this.replay.replayStream.close();

			return replay;
		}

		//********************************************************************************************************

		void parseHeader()
		{
         this.replay.replayVersion = this.replay.replayStream.readUInt32();
         this.replay.gameType        = this.replay.replayStream.readASCIIStr(8);

         //game date
         UInt32 L = 0;
         while (this.replay.replayStream.readUInt16() != 0) ++L;
         this.replay.replayStream.seek(12);
         this.replay.gameDate = this.decodeDate(this.replay.replayStream.readUnicodeStr(L));

         this.replay.replayStream.seek(76);

			this.parseChunky();
			this.parseChunky();

         this.replay.headerParsed = true;
		}

		//********************************************************************************************************

		void parseData()
      {
			UInt32 tickIndex	= 1;
         Replay.Tick tick;

			while (this.replay.replayStream.position < this.replay.replayStream.length)
			{
            if (this.replay.replayStream.readUInt32() == 1)
				{
               this.parseMessage(tickIndex);
				}
				else
				{
               tick = new Replay.Tick(this.replay.replayStream.readBytes(this.replay.replayStream.readUInt32()));

               //this.replay.ticks.Add(tick);
               
               this.parseTick(tick);
               
               tickIndex = tick.index;
				}
			}
         this.findPlayerIDs();
         this.findDoctrines();
      }

		//********************************************************************************************************

      void parseMessage(UInt32 tick)
      {
			try
			{
				long pos = this.replay.replayStream.position;
				long length = this.replay.replayStream.readUInt32();

				if (this.replay.replayStream.readUInt32() > 0)
				{
					this.replay.replayStream.skip(4);

					UInt32 L;
					string playerName;
					UInt16 playerID;

					if ((L = this.replay.replayStream.readUInt32()) > 0)
					{
						playerName = this.replay.replayStream.readUnicodeStr(L);
						playerID = this.replay.replayStream.readUInt16();
					}
					else
					{
						playerName = "System";
						playerID = 0;
						this.replay.replayStream.skip(2);
					}

					this.replay.replayStream.skip(6);

					UInt32 recipient = this.replay.replayStream.readUInt32();

					string message = this.replay.replayStream.readUnicodeStr(this.replay.replayStream.readUInt32());

					this.replay.addMessage(tick, playerName, playerID, message, recipient);
				}
				this.replay.replayStream.seek(pos + length + 4);
			}
			//TODO: message exception
			catch (Exception e)
			{
				
			}
		}

      //********************************************************************************************************

      void parseTick(Replay.Tick tick)
      {
         int i = 12;
         for (UInt32 bundleCount = 0; bundleCount < tick.bundleCount; ++bundleCount)
         {
            i += parseActions(tick, i) + 13;
         }
      }

      //********************************************************************************************************

      int parseActions(Replay.Tick tick, int index)
      {
         int bundleLength = (int)BitConverter.ToUInt32(tick.data, index + 9);

         int i = 14;
         while (i < bundleLength + 2)
         {
				int L = BitConverter.ToInt16(tick.data, index + i);
				byte[] data = new byte[L];
				for (int j = 0; j < L; ++j)
				{
					data[j] = tick.data[j + index + i];
				}

				replay.addAction(tick.tick, data);

				i += BitConverter.ToUInt16(tick.data, index + i);
         }

         return bundleLength;
      }

      //********************************************************************************************************

      bool parseChunk()
      {
         string chunkType = this.replay.replayStream.readASCIIStr(8);
         if (!(chunkType.Substring(0, 4).Equals("FOLD") || chunkType.Substring(0, 4).Equals("DATA")))
         {
            this.replay.replayStream.skip(-8);
            return false;
         }

         UInt32 chunkVersion		= this.replay.replayStream.readUInt32();
         UInt32 chunkLength		= this.replay.replayStream.readUInt32();
         UInt32 chunkNameLength	= this.replay.replayStream.readUInt32();

         this.replay.replayStream.skip(8);
				
         string chunkName = string.Empty;
         if( chunkNameLength > 0 )
         {
            chunkName = this.replay.replayStream.readASCIIStr(chunkNameLength);
         }

         long startPosition = this.replay.replayStream.position;

         if( chunkType.Substring(0, 4).Equals("FOLD") )
		   {
            while( this.replay.replayStream.position < startPosition + chunkLength )
            {
               this.parseChunk();
            }
		   }

         if (chunkType.Equals("DATASDSC") && (chunkVersion == 0x7d4))
         {
            this.replay.replayStream.skip(4);

            this.replay.replayStream.skip(12 + 2 * (int)this.replay.replayStream.readUInt32());

            this.replay.modName = this.replay.replayStream.readASCIIStr();

            this.replay.mapFileName = this.replay.replayStream.readASCIIStr();

            this.replay.replayStream.skip(20);

            this.replay.mapName = this.replay.replayStream.readUnicodeStr();

            this.replay.replayStream.skip(4);

            this.replay.mapDescription = this.replay.replayStream.readUnicodeStr();

            this.replay.replayStream.skip(4);

            this.replay.mapWidth = this.replay.replayStream.readUInt32();

            this.replay.mapHeight = this.replay.replayStream.readUInt32();
         }

         if (chunkType.Equals("DATABASE") && (chunkVersion == 0xb))
         {
            this.replay.replayStream.skip(8); //02 00 00 00 02 00 00 00 

            this.replay.replayStream.skip(8); //?

            this.replay.randomStart = (this.replay.replayStream.readUInt32() == 0);

            this.replay.replayStream.skip(4); //COLS

            this.replay.highResources = (this.replay.replayStream.readUInt32() == 1); //High resources

            this.replay.replayStream.skip(4); //TSSR

            this.replay.vpCount = (UInt16)(250 * (1 << (int)(this.replay.replayStream.readUInt32()))); // VP count

            this.replay.replayStream.skip(5); //KTPV 00

            this.replay.replayName = this.replay.replayStream.readUnicodeStr();

            this.replay.replayStream.skip(8);

            this.replay.VPgame = (this.replay.replayStream.readUInt32() == 0x603872a3); //anni/vp

            this.replay.replayStream.skip(23);

				this.replay.replayStream.readASCIIStr(); //gameminorversion
				this.replay.replayStream.skip(4);
				this.replay.replayStream.readASCIIStr(); //gamemajorversion
				this.replay.replayStream.skip(8);
				if (this.replay.replayStream.readUInt32() == 2)
				{
					this.replay.replayStream.readASCIIStr(); //gameversion
					this.replay.replayStream.readASCIIStr(); //199.117372 [04/27/11 09:18:18]
				}
				this.replay.replayStream.readASCIIStr(); //matchname
				
				this.replay.matchType = this.replay.replayStream.readASCIIStr();
         }

         if (chunkType.Equals("DATAINFO") && (chunkVersion == 6))
         {
            string player	= this.replay.replayStream.readUnicodeStr();
				UInt16 id		= this.replay.replayStream.readUInt16();

            this.replay.replayStream.skip(6);

            string faction	= this.replay.replayStream.readASCIIStr();

            this.replay.addPlayer(player, faction);
         }

			this.replay.replayStream.seek(startPosition + chunkLength);

         return true;
      }

      //********************************************************************************************************
      
     	bool parseChunky()
	   {
         if (!this.replay.replayStream.readASCIIStr(12).Equals("Relic Chunky")) return false;

         this.replay.replayStream.skip(4);

         if (this.replay.replayStream.readUInt32() != 3) return false;

         this.replay.replayStream.skip(4);

         this.replay.replayStream.skip((int)this.replay.replayStream.readUInt32() - 28);

         while( this.parseChunk() );

         return true;
	   }

      //********************************************************************************************************

      DateTime decodeDate(string s)
      {
         //24hr: DD-MM-YYYY HH:mm
         Regex reEuro   = new Regex(@"(\d\d).(\d\d).(\d\d\d\d)\s(\d\d).(\d\d)");
         if (reEuro.IsMatch(s))
         {
            GroupCollection g = reEuro.Match(s).Groups;
            return new DateTime( Convert.ToInt32(g[3].Value)
                               , Convert.ToInt32(g[2].Value)
                               , Convert.ToInt32(g[1].Value)
                               , Convert.ToInt32(g[4].Value)
                               , Convert.ToInt32(g[5].Value)
                               , 0
                               );
         }

         //12hr: MM/DD/YYYY hh:mm XM *numbers are not 0-padded
         Regex reUS = new Regex(@"(\d{1,2}).(\d{1,2}).(\d\d\d\d)\s(\d{1,2}).(\d{1,2}).*?(\w)M");
         if (reUS.IsMatch(s.ToUpper()))
         {
            GroupCollection g = reUS.Match(s).Groups;
            DateTime retval = new DateTime( Convert.ToInt32(g[3].Value)
                                          , Convert.ToInt32(g[1].Value)
                                          , Convert.ToInt32(g[2].Value)
                                          , Convert.ToInt32(g[4].Value)
                                          , Convert.ToInt32(g[5].Value)
                                          , 0
                                          );
            if ( (g[6].ToString().ToLower() == "p".ToLower()) && (Convert.ToInt32(g[4].Value) < 12) )
            {
               retval = retval.AddHours(12);
            }
            if ( (g[6].ToString().ToLower() == "a".ToLower()) && (Convert.ToInt32(g[4].Value) == 12) )
            {
               retval = retval.AddHours(-12).AddDays(1);
            }
            return retval;
         }

         //YYYY/MM/DD HH:MM
         Regex reAsian = new Regex(@"(\d\d\d\d).(\d\d).(\d\d)\s(\d\d).(\d\d)");
         if (reAsian.IsMatch(s))
         {
            GroupCollection g = reAsian.Match(s).Groups;
            return new DateTime( Convert.ToInt32(g[1].Value)
                               , Convert.ToInt32(g[2].Value)
                               , Convert.ToInt32(g[3].Value)
                               , Convert.ToInt32(g[4].Value)
                               , Convert.ToInt32(g[5].Value)
                               , 0
                               );
         }
         
         return DateTime.Now.ToLocalTime();
      }

      //********************************************************************************************************

      //TODO: Parser.findPlayerIDs
      void findPlayerIDs()
      {
         foreach (CoH.Replay.Player p in replay.playerIterator)
         {
            foreach (CoH.Replay.Message m in replay.messageIterator)
            {
               if (m.playerName == p.name)
               {
                  p.id = m.playerID;
                  break;
               }
            }
         }
      }

      //********************************************************************************************************

      void findDoctrines()
      {
         foreach (CoH.Replay.Player p in replay.playerIterator)
         {
            foreach (CoH.Replay.Action a in replay.actionIterator)
            {
               if (a.actionType == 0x62)
               {
                  if ((p.doctrine == 0) && (p.id == a.playerID))
                  {
                     p.doctrine = a.action;
                     break;
                  }
               }
            }
         }
      }

      //********************************************************************************************************
   }
}

