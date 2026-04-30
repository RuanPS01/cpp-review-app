#include <iostream>
#include <iomanip>
using namespace std;

int main ()
{
    int num;
    double total;
    cin >> num;
    
    double cont1 = 0;
    double cont2 = 0;
    double cont3 = 0;
    double cont4 = 0;
    double cont5 = 0;
    
    
    while( cin >> num && num != 6 ){
        total++; 
        
        if ( num == 1){
            cont1++;
        }
        else if ( num == 2){
            cont2++;
        }
        else if ( num == 3){
            cont3++;
        }
        else if ( num == 4){
            cont4++;
        }
        
        else if ( num == 5){
            cont5++;
        }
    }
    
    double porcetagem;
    porcetagem = ( 1/porcetagem)*100;
    
    double porce1 = (porcetagem * cont1);
    double porce2 = (porcetagem * cont2);
    double porce3 = (porcetagem * cont3);
    double porce4 = (porcetagem * cont4);
    double porce5 = (porcetagem * cont5);
    
     cout << fixed << setprecision(2);
    
    cout << "1 estrela: " << porce1 << "%" << endl;
    cout << "2 estrelas: " << porce2 << "%" << endl;
    cout << "3 estrelas: " << porce3 << "%" << endl;
    cout << "4 estrelas: " << porce4 << "%" << endl;
    cout << "5 estrelas: " << porce5 << "%" << endl;
    
    return 0;
}