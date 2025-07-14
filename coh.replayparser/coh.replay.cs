using System;
using System.Collections;
using System.ComponentModel;
using System.Data;
using System.Xml.Serialization;

namespace CoH
{
	public class Replay
	{
      public string     fileName       { get{ return header.fileName			; } set{ header.fileName			= value	;}	}
      public UInt32     replayVersion  { get{ return header.replayVersion	; } set{ header.replayVersion		= value	;}	}
      public string     gameType			{ get{ return header.gameType			; } set{ header.gameType			= value	;}	}
      public DateTime   gameDate       { get{ return header.gameDate			; } set{ header.gameDate			= value	;}	}
      public string     modName        { get{ return header.modName			; } set{ header.modName				= value	;}	}
      public string     mapFileName    { get{ return header.mapFileName		; } set{ header.mapFileName		= value	;}	}
      public string     mapName        { get{ return header.mapName			; } set{ header.mapName				= value	;}	}
      public string     mapDescription { get{ return header.mapDescription	; } set{ header.mapDescription	= value	;}	}
      public UInt32     mapWidth       { get{ return header.mapWidth			; } set{ header.mapWidth			= value	;}	}
      public UInt32     mapHeight      { get{ return header.mapHeight		; } set{ header.mapHeight			= value	;}	}
      public string     replayName     { get{ return header.replayName		; } set{ header.replayName			= value	;}	}
      public string     MD5Hash        { get{ return header.MD5Hash			; } set{ header.MD5Hash				= value	;}	}
		public string		matchType		{ get{ return header.matchType		; } set{ header.matchType			= value	;}	}
      public bool			highResources	{ get{ return header.highResources	; } set{ header.highResources		= value	;}	}
      public bool			randomStart		{ get{ return header.randomStart		; } set{ header.randomStart		= value	;}	}
      public UInt16		vpCount			{ get{ return header.vpCount			; } set{ header.vpCount				= value	;}	}
      public bool			VPgame			{ get{ return header.VPgame			; } set{ header.VPgame				= value	;}	}

		[XmlIgnore]	
      public bool headerParsed { get; set; }

		[XmlIgnore]	
      public int playerCount	{ get { return this.players.Count	; } }
		
		[XmlIgnore]	
      public int messageCount { get { return this.messages.Count	; } }
		
		[XmlIgnore]	
      public int actionCount	{ get { return this.actions.Count	; } }

		[XmlIgnore]	
      public CoH.ReplayStream replayStream { get; private set; }

		Header header;
		public BindingList<Player>  players	{ get; set; }
		public BindingList<Message> messages { get; set; }
		public BindingList<Action>  actions { get; set; }

      [XmlIgnore]
      CoH.ActionDefinitions actionDefinitions = null;

      //********************************************************************************************************

		public Replay()
		{ }

		public Replay(string fileName, CoH.ActionDefinitions actionDefinitions)
			: this(fileName)
		{
			this.actionDefinitions = actionDefinitions;
		}

		public Replay(string fileName)
      {
			this.header = new Header();

			this.players = new BindingList<Player>();
			this.messages = new BindingList<Message>();
			this.actions = new BindingList<Action>();

			this.replayStream = new CoH.ReplayStream(fileName);
			this.fileName		= fileName;
			this.MD5Hash		= this.replayStream.MD5hash;
      }

		//********************************************************************************************************

		public CoH.Replay.Player addPlayer(string name, string faction)
		{
			return this.addPlayer(name, faction, 0, 0);
		}
		
		public CoH.Replay.Player addPlayer(string name, string faction, UInt16 id, UInt16 doctrine)
		{
			Player p = new Player(name, faction, id, doctrine);
			this.players.Add(p);
			return p;
		}

		//********************************************************************************************************

		public CoH.Replay.Message addMessage(UInt32 tick, string playerName, UInt16 playerID, string message, UInt32 recipient)
		{
			Message m = new Message(tick, playerName, playerID, message, recipient);
			this.messages.Add(m);
			return m;
		}

		//********************************************************************************************************

		public CoH.Replay.Action addAction(UInt32 tick, byte[] data)
		{
			Action a = new Action(tick, data, actionDefinitions);
			this.actions.Add(a);
			return a;
		}

		//********************************************************************************************************

		[XmlIgnore]
		public IEnumerable playerIterator
		{
			get
			{
				for (int i = 0; i < this.players.Count; ++i)
				{
					yield return this.players[i];
				}
			}
		}

		//********************************************************************************************************

		[XmlIgnore]
		public IEnumerable messageIterator
		{
			get
			{
				for (int i = 0; i < this.messages.Count; ++i)
				{
					yield return this.messages[i];
				}
			}
		}

		//********************************************************************************************************

		[XmlIgnore]
		public IEnumerable actionIterator
		{
			get
			{
				for (int i = 0; i < this.actions.Count; ++i)
				{
					yield return this.actions[i];
				}
			}
		}

		//********************************************************************************************************

		public DataSet toDataSet()
		{
			DataSet ds = new DataSet("New replay");

			DataTable dt = ds.Tables.Add("replay");

			foreach (var prop in typeof(Header).GetProperties())
			{
				dt.Columns.Add(prop.Name, prop.PropertyType);
			}
			DataRow dr = dt.NewRow();
			foreach (var prop in typeof(Header).GetProperties())
			{
				dr[prop.Name] = prop.GetValue(header, null);
			}
			dt.Rows.Add(dr);

			toDataSet<Player>(players, ds);
			toDataSet<Message>(messages, ds);
			toDataSet<Action>(actions, ds);

			return ds;
		}

		void toDataSet<T>(BindingList<T> list, DataSet ds)
		{
			Type e = typeof(T);
			DataTable t = new DataTable();
			ds.Tables.Add(t);

			t.Columns.Add("md5hash", typeof(string));
			foreach (var prop in e.GetProperties())
			{
				t.Columns.Add(prop.Name, prop.PropertyType);
			}

			foreach (T item in list)
			{
				DataRow r = t.NewRow();
				r["md5hash"] = this.MD5Hash;
				foreach (var prop in e.GetProperties())
				{
					r[prop.Name] = prop.GetValue(item, null);
				}
				t.Rows.Add(r);
			}
		}
	
		//********************************************************************************************************
		//********************************************************************************************************
		//********************************************************************************************************
		
		class Header
		{
			public string     fileName       { get; set;	}
			public UInt32     replayVersion  { get; set;	}
			public string     gameType			{ get; set;	}
			public DateTime   gameDate       { get; set;	}
			public string     modName        { get; set;	}
			public string     mapFileName    { get; set;	}
			public string     mapName        { get; set;	}
			public string     mapDescription { get; set;	}
			public UInt32     mapWidth       { get; set;	}
			public UInt32     mapHeight      { get; set;	}
			public string     replayName     { get; set;	}
			public string     MD5Hash        { get; set;	}
			public string		matchType		{ get; set;	}
			public bool			highResources	{ get; set;	}
			public bool			randomStart		{ get; set;	}
			public UInt16		vpCount			{ get; set;	}
			public bool			VPgame			{ get; set;	}
		}

		//********************************************************************************************************
		//********************************************************************************************************
		//********************************************************************************************************
		
		public class Message
		{
         public enum chatTarget : uint { All, Team, System };

			public string timeStamp { get { return (new TimeSpan(10000000 / 8 * (Int64)tick)).ToString(@"hh\:mm\:ss"); } }

			public UInt32  tick        { get; set; }
         public string  playerName  { get; set; }
         public UInt16  playerID    { get; set; }
         public string  text        { get; set; }
         public UInt32  recipient   { get; set; }

			//********************************************************************************************************

         public Message()
         { }

         public Message(UInt32 tick, string playerName, UInt16 playerID, string message, UInt32 recipient)
         {
            this.tick         = tick;
            this.playerName   = playerName;
            this.playerID     = playerID;
            this.text         = message;
            this.recipient    = recipient;
         }
		}

		//********************************************************************************************************
		//********************************************************************************************************
		//********************************************************************************************************

		public class Player
		{
			public string name      { get; set; }
			public UInt16 id        { get; set; }
			public String faction   { get; set; }
         public UInt16 doctrine  { get; set; }

			//********************************************************************************************************

			Player()
			{}

			public Player(string name, string faction, UInt16 id, UInt16 doctrine)
			{
				this.name      = name;
				this.faction   = faction;
				this.id			= id;
				this.doctrine	= doctrine;
			}
		}

		//********************************************************************************************************
		//********************************************************************************************************
		//********************************************************************************************************

		public class Action
		{
         public class Coordinate
         {
            public Single x = Single.NaN;
				public Single y = Single.NaN;
				public Single z = Single.NaN;

            public override string ToString()
            {
               return string.Format("({0}, {1}, {2})", x, y, z);
            }
         }

			//********************************************************************************************************

			public string timeStamp { get { return (new TimeSpan(10000000 / 8 * (Int64)tick)).ToString(@"hh\:mm\:ss"); } }

			[Browsable(false)]
			public UInt32	tick				{ get; set; }
			
			[Browsable(false)]
			public UInt16  length         { get; set; }
			
			[Browsable(false)]
			public byte    actionType     { get; set; }
			
			[Browsable(false)]
			public byte    baseLocation   { get; set; }
			
			[Browsable(false)]
			public UInt16  action         { get; set; }
			
			[Browsable(false)]
			public UInt16  playerID       { get; set; }
			
			[Browsable(false)]
			public UInt16  unitID         { get; set; }
			
			[Browsable(false)]
         public byte[]  data           { get; set; }

			[XmlIgnore]
			public string actionTypeText	
			{ 
				get 
				{ 
					return (actionDefinitions != null) ? actionDefinitions.getActionTypeText(actionType) : string.Empty; 
				} 
			}

			[XmlIgnore]
			public string actionText		
			{ 
				get 
				{ 
					return (actionDefinitions != null) ? actionDefinitions.getActionText(actionType, action) : string.Empty; 
				} 
			}
			[XmlIgnore]
			public bool	actionHasLocation	
			{ 
				get 
				{ 
					return (actionDefinitions != null) ? actionDefinitions.getActionHasLocation(actionType, action) : false; 
				} 
			}

			public Coordinate coordinate1 { get; set; }
			public Coordinate coordinate2 { get; set; }

			CoH.ActionDefinitions actionDefinitions;

			//********************************************************************************************************

			Action()
			{ }

			public Action(UInt32 tick, byte[] data, CoH.ActionDefinitions actionDefinitions)
			{
				this.actionDefinitions = actionDefinitions;
				
				this.coordinate1 = new Coordinate();
				this.coordinate2 = new Coordinate();

				this.tick	= tick;
				this.length = (UInt16)data.Length;
				this.data	= data;

				if (this.length > 16)
				{
					this.actionType	= data[2];
					this.baseLocation = data[3];
					this.playerID		= BitConverter.ToUInt16(this.data, 4);
					this.unitID			= BitConverter.ToUInt16(this.data, 10);
					this.action			= BitConverter.ToUInt16(this.data, 14);

					if (this.length > 29)
					{
						this.coordinate1.x = BitConverter.ToSingle(this.data, 18);
						this.coordinate1.y = BitConverter.ToSingle(this.data, 22);
						this.coordinate1.z = BitConverter.ToSingle(this.data, 26);
						
						if (this.length > 41)
						{
							this.coordinate2.x = BitConverter.ToSingle(this.data, 30);
							this.coordinate2.y = BitConverter.ToSingle(this.data, 34);
							this.coordinate2.z = BitConverter.ToSingle(this.data, 38);
						}
					}
				}
			}

			//********************************************************************************************************

			public DateTime tickToTime(UInt32 tick)
			{
				return new DateTime(10000000 / 8 * (Int64)tick);
			}
		}

		//********************************************************************************************************
		//********************************************************************************************************
		//********************************************************************************************************

		public class Tick
		{
			public UInt32 tick { get; set; }
			public int length { get; set; }
			public UInt32 index { get; set; }
			public UInt32 bundleCount { get; set; }
			public byte[] data { get; set; }

			//********************************************************************************************************

			public Tick(byte[] data)
			{
				this.tick = BitConverter.ToUInt32(data, 1);
				this.data = data;
				this.length = data.Length;
				this.index = this.tick;
				this.bundleCount = BitConverter.ToUInt32(data, 9);
			}
		}

		//********************************************************************************************************
		//********************************************************************************************************
		//********************************************************************************************************
	}
}