function Init_API() {
    var url = "";
    return {
        DonVi: "CNGT",
        urlNode: 'https://api-apis.com',
        CM: url + '/csacmapi/api',
        SYS: url + '/csacmapi/api',
        CMS: url + '/cmsapi/api',
        DKH: url + '/dangkyhocapi/api',
        KHCT: url + '/kehoachchuongtrinhapi/api',
        KS: url + '/qlkhaosatapi/api',
        KTX: url + '/kytucxaapi/api',
        NCKH: url + '/nckhapi/api',
        NS: url + '/nhansuapi/api',
        D: url + '/quanlydiemapi/api',
        SV: url + '/sinhvienapi/api',
        SMS: url + '/smsapi/api',
        TC: url + '/taichinhapi/api',
        TKGG: url + '/tkggapi/api',
        L: url + '/luongapi/api',
        CC: url + '/chuyencanapi/api',
        HLTL: url + '/hoclaithilaiapi/api',
        RL: url + '/renluyenapi/api',
        XLHV: url + '/xulyhocvuapi/api',
        HDDT: url + '/hddtviettelapi/api',
        NH: url + '/nhaphocapi/api',
        TS: url + '/quanlytuyensinhapi/api',
        LVLA: url + '/luanvanluananapi/api',
        TN: url + '/totnghiepapi/api',        
	TT: url + '/tintucapi/api',
        QLTTN: url + '/quanlythitracnghiemapi/api',
        TP: url + '/thiphachapi/api',        
	CTT: url + '/thanhtoantructuyen/api',
        TTN: url + '/thitracnghiemapi/api',
        KS: url + '/qlkhaosatapi/api',
	urlKhaoSat: '/congthongtin/pages/thuchienkhaosat.aspx'

    };
}
//Replace html & js before load. warning 
function ReplicaWithText() {
    return {
        All: {

        },
        ApisCongCanBo: {

        }
    };
}
//replace html after load
function ReplicaWithDom() {
    return {
        All: {
            ".cosoxet": "trường."//
        },
        ApisCongCanBo: {
        }
    };
}
