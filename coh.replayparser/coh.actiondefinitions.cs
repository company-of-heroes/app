using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using System.Collections;
using System.Data;

namespace CoH
{
   public class ActionDefinitions
   {
      string fileName;
      Dictionary<UInt16, Dictionary<UInt16, ActionDefinition>> actionDefinitions;

      public class ActionDefinition
      {
         public UInt16  type;
         public UInt16  id;
         public string  text;
         public bool    hasLocation;
      }
      
      //********************************************************************************************************

      public ActionDefinitions(string fileName)
      {
         this.fileName = fileName;
         this.actionDefinitions = new Dictionary<ushort, Dictionary<ushort, ActionDefinition>>();
         this.load();
      }
      
      //********************************************************************************************************

		public void load()
      {
			Regex regex = new Regex(@"^(\d+)[,;](\d+?)[,;]""(.+?)""[,;](\d)$");
         StreamReader sr = new StreamReader(fileName);

         while (!sr.EndOfStream)
         {
            string s = sr.ReadLine();
            if (regex.IsMatch(s))
            {
               ActionDefinition ad = new ActionDefinition();
               
               GroupCollection g = regex.Match(s).Groups;
               ad.type         = Convert.ToUInt16(g[1].ToString());
               ad.id           = Convert.ToUInt16(g[2].ToString());
               ad.text         = g[3].ToString();
               ad.hasLocation  = g[4].ToString() == "1" ? true : false;

               if (!actionDefinitions.ContainsKey(ad.type))
               {
                  actionDefinitions.Add(ad.type, new Dictionary<ushort,ActionDefinition>());
               }

               if (!actionDefinitions[ad.type].ContainsKey(ad.id))
               {
                  actionDefinitions[ad.type].Add(ad.id, ad);
               }
            }
         }

         sr.Close();
      }

      //********************************************************************************************************

      public void save()
      {
         this.save(this.fileName);
      }

      public void save(string fileName)
      {
         StreamWriter sw = new StreamWriter(fileName);
         foreach (UInt16 type in actionDefinitions.Keys)
         {
            foreach (UInt16 id in actionDefinitions[type].Keys)
            {
               ActionDefinition ad = actionDefinitions[type][id];
               sw.WriteLine(string.Format(@"{0};{1};""{2}"";{3}", ad.type, ad.id, ad.text, ad.hasLocation ? 1 : 0));
            }
         }
         sw.Flush();
         sw.Close();

         this.fileName = fileName;
      }

      //********************************************************************************************************

      public string getActionTypeText(UInt16 actionGroup)
      {
         return string.Empty;
      }

      //********************************************************************************************************

      public string getActionText(UInt16 actionGroup, UInt16 action)
      {
         if (actionDefinitions.ContainsKey(actionGroup))
         {
            if (actionDefinitions[actionGroup].ContainsKey(action))
            {
               return actionDefinitions[actionGroup][action].text;
            }
         }
         return "UNKNOWN";
      }


      //********************************************************************************************************

      public bool getActionHasLocation(UInt16 actionGroup, UInt16 action)
      {
         if (actionDefinitions.ContainsKey(actionGroup))
         {
            if (actionDefinitions[actionGroup].ContainsKey(action))
            {
               return actionDefinitions[actionGroup][action].hasLocation;
            }
         }
         return false;
      }

		//********************************************************************************************************

		public IEnumerable getIterator()
		{
			foreach (UInt16 type in actionDefinitions.Keys)
			{
				foreach (UInt16 id in actionDefinitions[type].Keys)
				{
					yield return actionDefinitions[type][id];
				}
			}			
		}

		//********************************************************************************************************
	}
}
