#include <iostream>
#include <iomanip>
using namespace std;
int main(){
    int x, um = 0, dois = 0, tres = 0, quatro = 0, cinco = 0, p = 0;
    float a, b, c, d, e;
    while(true){
        cin >> x;
        
        p++;
        
        if(x == 1){
            um = um + 1;
        }
        else if(x == 2){
            dois++;
        }
        else if(x == 3){
            tres++;
        }
        else if(x == 4){
            quatro++;
        }
        else if(x == 5){
            cinco++;
        }
        else if(x == 6){
            break;
        }
        
    }
    a = (um/p)*100;
    b = (dois/p)*100; 
    c = (tres/p)*100; 
    d = (quatro/p)*100; 
    e = (cinco/p)*100; 
    cout << fixed << setprecision(2);
    cout <<"1 estrela: " << a << "%" << endl; 
    cout <<"2 estrela: " << b << "%" << endl;  
    cout <<"3 estrela: " << c << "%" << endl; 
    cout <<"4 estrela: " << d << "%" << endl; 
    cout <<"5 estrela: " << e << "%" << endl; 
    return 0;
    
}