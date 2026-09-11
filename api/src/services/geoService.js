const axios = require('axios');
async function getIpBilgi(ip){
  try{
    const clean=(ip||'').replace('::ffff:','');
    if(!clean||clean==='127.0.0.1'||clean==='::1') return { sehir:'Localhost', ulke:'-', isp:'' };
    const res=await axios.get(`http://ip-api.com/json/${clean}?lang=tr&fields=status,city,regionName,country,isp,query`,{timeout:3000});
    if(res.data.status==='success') return { sehir:res.data.city, bolge:res.data.regionName, ulke:res.data.country, isp:res.data.isp };
  }catch(e){}
  return { sehir:'Bilinmiyor', bolge:'', ulke:'', isp:'' };
}
// Login protokollieren (nicht blockierend)
async function girisKaydet(query, userId, req, basarili=true){
  try{
    const ip=(req.headers['x-real-ip']||req.headers['x-forwarded-for']||req.ip||'').split(',')[0].trim();
    const ua=req.headers['user-agent']||'';
    const geo=await getIpBilgi(ip);
    await query(`INSERT INTO kullanici_girisler(user_id,ip_adresi,sehir,ulke,tarayici,basarili) VALUES($1,$2,$3,$4,$5,$6)`,
      [userId, ip, geo.sehir, geo.ulke, ua, basarili]);
  }catch(e){}
}
module.exports={ getIpBilgi, girisKaydet };
