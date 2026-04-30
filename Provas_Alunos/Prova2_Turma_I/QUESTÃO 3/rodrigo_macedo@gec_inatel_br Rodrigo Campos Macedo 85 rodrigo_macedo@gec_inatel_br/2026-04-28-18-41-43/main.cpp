#include <iostream>
#include <iomanip>
using namespace std;

int main(){
    
    int nota;
    float uma =0;
    float duas =0;
    float tres =0;
    float quatro =0;
    float cinco =0;
    float notas;
    
    cin >> nota;
    while(true){
        
        if(nota == 6)
            break; 
        
        if(nota == 1){
            uma++;
        }
        else if(nota == 2){
            duas++;
        }
        else if(nota == 3){
            tres++;
        }
        else if(nota == 4){
            quatro++;
        }
        else if(nota == 5){
            cinco++;
        }
        notas ++;
        cin >> nota;
    }
    
    uma = uma / notas;
    duas = duas / notas;
    tres = tres / notas;
    quatro = quatro / notas;
    cinco = cinco / notas;
    
    cout << fixed << setprecision(2);
    
    cout << "1 estrela: " << uma * 100 << "%" << endl;
    cout << "2 estrelas: " << duas * 100 << "%" << endl; 
    cout << "3 estrelas: " << tres * 100 << "%" << endl; 
    cout << "4 estrelas: " << quatro * 100 << "%" << endl; 
    cout << "5 estrelas: " << cinco * 100 << "%" << endl; 


    return 0;
}