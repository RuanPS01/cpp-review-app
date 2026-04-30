#include <iostream>
#include <iomanip>
using namespace std;

int main(){
    
    int N;
    float alt[100];
    float maior = 0.00;
    double menor = 3; 
    
    cin >> N;
    
    for(int i = 0; i < N; i++){
        cin >> alt[i];
       
       if(alt[i] > maior){
           maior = alt[i];
       }
       if(alt[i] < menor){
           menor = alt[i];
       }
    }
    
    cout << fixed << setprecision(2);
    cout << "Menor altura: " << menor << endl;
    cout << "Maior altura: " << maior << endl;
    
    
    
    
    
    return 0;
}