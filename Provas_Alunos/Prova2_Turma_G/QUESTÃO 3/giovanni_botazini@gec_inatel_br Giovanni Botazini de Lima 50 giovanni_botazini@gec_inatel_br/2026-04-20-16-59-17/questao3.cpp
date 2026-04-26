#include<iostream>
#include<iomanip>

using namespace std;

int main(){
    
    
    int numeros;
    double media = 0;
    int maior_tempo;
   double soma = 0;
    
    while(true){
        cin >> numeros;
        
        if(numeros != 0){
            break;
        }
        
        for(int i = 0; i < numeros; i++){
            
            
            if(numeros >  soma){
                soma += maior_tempo;
                cout << "Maior tempo: " << endl;
                
            }else{
                
                media = soma / numeros;
            cout << "Media dos tempos: " << endl;
         }
      }
    }
     
    cout << fixed << setprecision(2) << media << endl;
    return 0;



}